"""
Admin-managed dropdown lists — matches frontend/src/api/configLists.ts and
frontend/src/api/mpDestinations.ts.
"""
from collections import Counter
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ConfigListItem, Proposal, PurchaseOrder, Invoice
from app.security import get_current_user, require_write_access

router = APIRouter(tags=["config-lists"])

LIST_NAMES = {"job_codes", "payment_terms", "references", "mp_destinations"}


class ItemInput(BaseModel):
    model_config = ConfigDict(extra="ignore")

    label: Optional[str] = None
    active: Optional[bool] = None
    delay_days: Optional[int] = None
    physical_address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None


def _check_name(name: str) -> None:
    if name not in LIST_NAMES:
        raise HTTPException(status_code=404, detail={"message": "Unknown list"})


def serialize(item: ConfigListItem) -> dict:
    data = {
        "id": str(item.id),
        "label": item.label,
        "active": item.active,
        "delay_days": item.delay_days,
        "physical_address": item.physical_address,
        "city": item.city,
        "state": item.state,
    }
    return {k: v for k, v in data.items() if v is not None}


def _items(db: Session, name: str, include_inactive: bool) -> list[ConfigListItem]:
    stmt = select(ConfigListItem).where(ConfigListItem.list_name == name)
    if not include_inactive:
        stmt = stmt.where(ConfigListItem.active.is_(True))
    return list(db.execute(stmt.order_by(ConfigListItem.sort_order, ConfigListItem.id)).scalars())


def _get_item(db: Session, name: str, item_id: str) -> ConfigListItem:
    try:
        item = db.get(ConfigListItem, int(item_id))
    except ValueError:
        item = None
    if item is None or item.list_name != name:
        raise HTTPException(status_code=404, detail={"message": "Item not found"})
    return item


def _check_label(db: Session, name: str, label: Optional[str], exclude_id: Optional[int] = None) -> str:
    clean = (label or "").strip()
    if not clean:
        raise HTTPException(status_code=422, detail={"message": "Label is required"})
    stmt = select(ConfigListItem.id).where(
        ConfigListItem.list_name == name, func.lower(ConfigListItem.label) == clean.lower()
    )
    if exclude_id is not None:
        stmt = stmt.where(ConfigListItem.id != exclude_id)
    if db.execute(stmt).first():
        raise HTTPException(status_code=409, detail={"message": "That value already exists"})
    return clean


def usage_counts(db: Session, name: str) -> dict[str, int]:
    counts: Counter = Counter()
    if name == "job_codes":
        for model in (Proposal, PurchaseOrder, Invoice):
            for (items,) in db.execute(select(model.line_items)):
                for li in items or []:
                    if li.get("job_code"):
                        counts[li["job_code"]] += 1
    elif name == "payment_terms":
        for model in (PurchaseOrder, Invoice):
            for (terms,) in db.execute(select(model.payment_terms).where(model.payment_terms.is_not(None))):
                counts[terms] += 1
    elif name == "references":
        for (ref,) in db.execute(select(Proposal.reference).where(Proposal.reference.is_not(None))):
            counts[ref] += 1
    elif name == "mp_destinations":
        for (loc,) in db.execute(select(Proposal.project_location).where(Proposal.project_location.is_not(None))):
            counts[loc] += 1
    return {item.label: counts.get(item.label, 0) for item in _items(db, name, include_inactive=True)}


@router.get("/config-lists/{name}")
def get_list(name: str, include_inactive: bool = False, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    _check_name(name)
    return [serialize(i) for i in _items(db, name, include_inactive)]


@router.get("/config-lists/{name}/usage")
def get_usage(name: str, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    _check_name(name)
    return usage_counts(db, name)


@router.post("/config-lists/{name}/items", status_code=201)
def add_item(name: str, data: ItemInput, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    _check_name(name)
    label = _check_label(db, name, data.label)
    max_order = db.execute(
        select(func.coalesce(func.max(ConfigListItem.sort_order), 0)).where(ConfigListItem.list_name == name)
    ).scalar_one()
    item = ConfigListItem(
        list_name=name, label=label, active=True, sort_order=max_order + 1,
        delay_days=data.delay_days, physical_address=data.physical_address, city=data.city, state=data.state,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return serialize(item)


@router.patch("/config-lists/{name}/items/{item_id}")
def update_item(name: str, item_id: str, data: ItemInput, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    _check_name(name)
    item = _get_item(db, name, item_id)
    patch = data.model_dump(exclude_unset=True)
    if "label" in patch:
        item.label = _check_label(db, name, data.label, exclude_id=item.id)
    for field in ("active", "delay_days", "physical_address", "city", "state"):
        if field in patch:
            setattr(item, field, patch[field])
    db.commit()
    db.refresh(item)
    return serialize(item)


@router.delete("/config-lists/{name}/items/{item_id}")
def delete_item(name: str, item_id: str, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    _check_name(name)
    item = _get_item(db, name, item_id)
    used = usage_counts(db, name).get(item.label, 0)
    if used > 0:
        raise HTTPException(status_code=409, detail={"message": "Item is in use", "count": used})
    db.delete(item)
    db.commit()
    return {"id": item_id}


@router.get("/mp-destinations", tags=["mp-destinations"])
def mp_destinations(db: Session = Depends(get_db), _user=Depends(get_current_user)):
    return [
        {k: v for k, v in {
            "id": str(i.id),
            "final_destination": i.label,
            "physical_address": i.physical_address or "",
            "city": i.city,
            "state": i.state,
        }.items() if v is not None}
        for i in _items(db, "mp_destinations", include_inactive=False)
    ]
