"""
Shared logic for the two contact tables (clients, subcontractors), which use
the identical flat ClientContact shape. Mirrors the normalization the
frontend mocks applied (trim, empty -> null, recompose address_full).
"""
from typing import Optional

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, func
from sqlalchemy.orm import Session

FIELDS = (
    "name", "address", "title", "business_name", "department", "phone", "email",
    "city", "county", "state", "zip", "facility",
)

STATE_ABBR = {"California": "CA", "Texas": "TX", "New York": "NY", "Nevada": "NV"}


class ContactInput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str = ""
    address: str = ""
    title: Optional[str] = None
    business_name: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    county: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    facility: Optional[str] = None
    address_full: Optional[str] = None


class ImportPlanItem(BaseModel):
    model_config = ConfigDict(extra="allow")

    action: str
    existingId: Optional[str] = None
    row: ContactInput


class ImportPlan(BaseModel):
    model_config = ConfigDict(extra="allow")

    items: list[ImportPlanItem] = []
    newCount: int = 0
    updateCount: int = 0
    unchangedCount: int = 0


def _clean(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def normalize(data: ContactInput) -> dict:
    out = {f: _clean(getattr(data, f)) for f in FIELDS}
    out["name"] = out["name"] or ""
    out["address"] = out["address"] or ""
    if not out["name"]:
        raise HTTPException(status_code=422, detail={"message": "Name is required"})
    state = STATE_ABBR.get(out["state"] or "", out["state"] or "")
    city_zip = ", ".join(p for p in [out["city"], " ".join(p for p in [state, out["zip"]] if p)] if p)
    out["address_full"] = ", ".join(p for p in [out["address"], city_zip] if p) or None
    return out


def serialize(row, with_id: bool = True) -> dict:
    data = {f: getattr(row, f) for f in FIELDS}
    data["address_full"] = row.address_full
    data = {k: v for k, v in data.items() if v is not None}
    data.setdefault("name", "")
    data.setdefault("address", "")
    if with_id:
        data["id"] = str(row.id)
    return data


def search_names(db: Session, model, q: str) -> list[str]:
    stmt = select(model.name).distinct().where(model.name != "")
    if q.strip():
        stmt = stmt.where(model.name.ilike(f"%{q.strip()}%"))
    return sorted(n for (n,) in db.execute(stmt))


def lookup(db: Session, model, name: str) -> list[dict]:
    key = name.strip().lower()
    rows = db.execute(
        select(model).where(func.lower(func.trim(model.name)) == key).order_by(model.id)
    ).scalars()
    return [serialize(r) for r in rows]


def list_all(db: Session, model) -> list[dict]:
    return [serialize(r) for r in db.execute(select(model).order_by(model.id)).scalars()]


def create(db: Session, model, data: ContactInput) -> dict:
    row = model(**normalize(data))
    db.add(row)
    db.commit()
    db.refresh(row)
    return serialize(row)


def get_or_404(db: Session, model, raw_id: str, label: str):
    try:
        row = db.get(model, int(raw_id))
    except (TypeError, ValueError):
        row = None
    if row is None:
        raise HTTPException(status_code=404, detail={"message": f"{label} {raw_id} not found"})
    return row


def update(db: Session, model, raw_id: str, data: ContactInput, label: str) -> dict:
    row = get_or_404(db, model, raw_id, label)
    for k, v in normalize(data).items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return serialize(row)


def commit_import(db: Session, model, plan: ImportPlan) -> ImportPlan:
    for item in plan.items:
        values = normalize(item.row)
        if item.action == "create":
            db.add(model(**values))
        elif item.action == "update" and item.existingId:
            try:
                row = db.get(model, int(item.existingId))
            except ValueError:
                row = None
            if row is not None:
                for k, v in values.items():
                    setattr(row, k, v)
    db.commit()
    return plan
