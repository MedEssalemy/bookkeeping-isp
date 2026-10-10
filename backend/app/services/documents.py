"""
Helpers shared by the proposal / purchase-order / invoice routers.

The API speaks the frontend's shapes (frontend/src/types/*.ts): string ids,
ISO date strings, plain numbers, and optional fields omitted rather than null.
"""
import re
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any, Iterable

from fastapi import HTTPException, status
from sqlalchemy import func, select, or_
from sqlalchemy.orm import Session

from app.models import Client, Subcontractor, ConfigListItem, Attachment


# ---------- conversions ----------
def to_num(v: Any) -> float:
    if v is None:
        return 0.0
    return float(v)


def iso(v: Any) -> str | None:
    if v is None:
        return None
    if isinstance(v, (date, datetime)):
        return v.isoformat()
    return str(v)


def parse_id(v: Any) -> int | None:
    if v is None or v == "":
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def parse_date(v: Any) -> date | None:
    if not v:
        return None
    if isinstance(v, date):
        return v
    try:
        return date.fromisoformat(str(v)[:10])
    except ValueError:
        raise HTTPException(status_code=422, detail={"message": f"Invalid date: {v}"}) from None


def require_date(v: Any) -> date:
    d = parse_date(v)
    if d is None:
        raise HTTPException(status_code=422, detail={"message": "Date is required"})
    return d


def clean_str(v: Any) -> str | None:
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def drop_none(d: dict) -> dict:
    """Optional fields are omitted (undefined on the frontend), never null."""
    return {k: v for k, v in d.items() if v is not None}


def get_or_404(db: Session, model, raw_id: Any, label: str):
    obj_id = parse_id(raw_id)
    obj = db.get(model, obj_id) if obj_id is not None else None
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": f"{label} not found"})
    return obj


# ---------- line items & totals ----------
def _num_or_none(v: Any) -> float | None:
    if v is None or v == "":
        return None
    return float(v)


def calc_standard_items(items: Iterable[dict]) -> list[dict]:
    """job_code/description/qty/rate -> + id, amount. qty NULL = lump-sum (amount = rate)."""
    out = []
    for li in items or []:
        qty = _num_or_none(li.get("qty"))
        rate = _num_or_none(li.get("rate")) or 0.0
        out.append({
            "id": uuid.uuid4().hex[:10],
            "job_code": li.get("job_code") or None,
            "description": li.get("description") or "",
            "qty": qty,
            "rate": rate,
            "amount": rate if qty is None else qty * rate,
        })
    return out


def calc_mp_items(items: Iterable[dict]) -> list[dict]:
    """services/hourly_rate/hours_estimated -> + id, estimated_fee. Rate NULL = lump-sum."""
    out = []
    for li in items or []:
        hourly = _num_or_none(li.get("hourly_rate"))
        hours = _num_or_none(li.get("hours_estimated")) or 0.0
        out.append({
            "id": uuid.uuid4().hex[:10],
            "services": li.get("services") or "",
            "hourly_rate": hourly,
            "hours_estimated": hours,
            "estimated_fee": hours if hourly is None else hourly * hours,
            "job_code": "Medical Physics Services",
        })
    return out


def apply_totals(doc, items: list[dict], taxable: bool, tax_rate: float, amount_key: str = "amount") -> None:
    subtotal = sum(float(li.get(amount_key) or 0) for li in items)
    rate = float(tax_rate or 0) if taxable else 0.0
    sales_tax = subtotal * rate
    doc.line_items = items
    doc.taxable = bool(taxable)
    doc.tax_rate = Decimal(str(rate))
    doc.subtotal = Decimal(str(round(subtotal, 2)))
    doc.sales_tax = Decimal(str(round(sales_tax, 2)))
    doc.total = Decimal(str(round(subtotal + sales_tax, 2)))


def job_codes_of(items: Iterable[dict]) -> list[str]:
    seen: list[str] = []
    for li in items or []:
        code = li.get("job_code")
        if code and code not in seen:
            seen.append(code)
    return seen


def job_code_filter(column, codes: list[str] | None):
    """JSONB containment: any line item carrying any of the given job codes."""
    if not codes:
        return None
    return or_(*[column.contains([{"job_code": c}]) for c in codes])


# ---------- numbering ----------
def next_free_number(db: Session, number_col, prefix: str, *filters) -> str:
    """Legacy rule: PREFIX + YY + #### using the first free sequence number."""
    yy = date.today().strftime("%y")
    head = f"{prefix}{yy}"
    stmt = select(number_col).where(number_col.like(f"{head}%"), *filters)
    used = set()
    pattern = re.compile(rf"^{re.escape(head)}(\d{{4}})$")
    for (num,) in db.execute(stmt):
        m = pattern.match(num or "")
        if m:
            used.add(int(m.group(1)))
    n = 1
    while n in used:
        n += 1
    return f"{head}{n:04d}"


# ---------- payment terms / due dates ----------
def payment_term_delays(db: Session) -> dict[str, int]:
    rows = db.execute(
        select(ConfigListItem.label, ConfigListItem.delay_days).where(ConfigListItem.list_name == "payment_terms")
    ).all()
    return {label: (days or 0) for label, days in rows}


def due_date(doc_date: date | None, terms: str | None, delays: dict[str, int]) -> date | None:
    if doc_date is None:
        return None
    return doc_date + timedelta(days=delays.get(terms or "", 0))


# ---------- counterparty links (ERD junctions) ----------
def _norm(name: str | None) -> str:
    return (name or "").strip().lower()


def matching_parties(db: Session, model, name: str | None) -> list:
    key = _norm(name)
    if not key:
        return []
    return list(db.execute(select(model).where(func.lower(func.trim(model.name)) == key)).scalars())


def matching_clients(db: Session, name: str | None) -> list[Client]:
    return matching_parties(db, Client, name)


def matching_subcontractors(db: Session, name: str | None) -> list[Subcontractor]:
    return matching_parties(db, Subcontractor, name)


# ---------- duplicate number handling ----------
def ensure_number_free(db: Session, model, number_col, number: str, direction: str,
                       replace: bool, label: str, exclude_id: int | None = None) -> None:
    """409 when (number, direction) is taken. With replace=True the existing
    document is deleted first — the legacy delete-and-replace flow."""
    stmt = select(model).where(number_col == number, model.direction == direction)
    if exclude_id is not None:
        stmt = stmt.where(model.id != exclude_id)
    existing = db.execute(stmt).scalar_one_or_none()
    if existing is None:
        return
    if not replace:
        raise HTTPException(status_code=409, detail={"message": f"{label} number already exists"})
    delete_attachments(db, MODULE_OF[model.__tablename__], existing.id)
    db.delete(existing)
    db.flush()


MODULE_OF = {"proposals": "proposals", "purchase_orders": "pos", "invoices": "invoices"}


def delete_attachments(db: Session, module: str, record_id: int) -> None:
    db.query(Attachment).filter(Attachment.module == module, Attachment.record_id == record_id).delete()


def paginate(items: list, page: int, page_size: int) -> dict:
    page = max(page or 1, 1)
    page_size = max(page_size or 50, 1)
    start = (page - 1) * page_size
    return {"items": items[start:start + page_size], "total": len(items), "page": page, "page_size": page_size}


def placeholder_document(kind: str, number: str) -> bytes:
    return (
        f"{kind}\n\nNumber: {number}\nGenerated: {datetime.now().isoformat()}\n\n"
        "[.docx generation is not implemented on the backend yet]"
    ).encode("utf-8")
