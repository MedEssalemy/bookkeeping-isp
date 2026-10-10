"""
Invoices — matches frontend/src/api/invoices.ts.
Issued = clients side (we bill the client), received = contractors side.
"""
from datetime import date
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Invoice
from app.rich_text import clean_rich_text
from app.security import get_current_user, require_write_access
from app.services import documents as docs

router = APIRouter(prefix="/invoices", tags=["invoices"])


class InvoicePayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    number: Optional[str] = None
    direction: str = "issued"
    status: str
    date: str
    po_id: Optional[str] = None
    po_number: Optional[str] = None
    proposal_id: Optional[str] = None
    proposal_number: Optional[str] = None
    client_name: str = ""
    address: Optional[str] = None
    title: Optional[str] = None
    business_name: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    project_no: Optional[str] = None
    agreement_no: Optional[str] = None
    ship_date: Optional[str] = None
    payment_terms: Optional[str] = None
    taxable: bool = False
    tax_rate: float = 0
    payments_credits: float = 0
    line_items: list[dict[str, Any]] = []
    notes: Optional[str] = None
    linked_client_po_id: Optional[str] = None
    linked_owner_invoice_id: Optional[str] = None
    replace_existing: bool = False


class StatusPatch(BaseModel):
    status: str


TEXT_FIELDS = (
    "po_number", "proposal_number", "address", "title", "business_name", "department",
    "phone", "email", "project_no", "agreement_no", "payment_terms",
)


def _sid(v: int | None) -> str | None:
    return str(v) if v else None


def serialize(inv: Invoice) -> dict:
    return docs.drop_none({
        "id": str(inv.id),
        "direction": inv.direction,
        "number": inv.invoice_number,
        "status": inv.status,
        "date": docs.iso(inv.invoice_date),
        "po_id": _sid(inv.purchase_order_id),
        "proposal_id": _sid(inv.proposal_id),
        "client_name": inv.client_name or "",
        **{f: getattr(inv, f) for f in TEXT_FIELDS},
        "ship_date": docs.iso(inv.ship_date),
        "taxable": inv.taxable,
        "tax_rate": docs.to_num(inv.tax_rate),
        "subtotal": docs.to_num(inv.subtotal),
        "sales_tax": docs.to_num(inv.sales_tax),
        "total": docs.to_num(inv.total),
        "payments_credits": docs.to_num(inv.payments_credits),
        "line_items": inv.line_items or [],
        "notes": inv.notes,
        "linked_client_po_id": _sid(inv.linked_client_po_id),
        "linked_owner_invoice_id": _sid(inv.linked_owner_invoice_id),
        "created_at": docs.iso(inv.created_at),
        "updated_at": docs.iso(inv.updated_at),
    })


def _is_overdue(inv: Invoice, due: date | None) -> bool:
    return inv.status != "Paid" and due is not None and date.today() > due


def serialize_list_item(inv: Invoice, delays: dict[str, int]) -> dict:
    due = docs.due_date(inv.invoice_date, inv.payment_terms, delays)
    return docs.drop_none({
        "id": str(inv.id),
        "number": inv.invoice_number,
        "direction": inv.direction,
        "status": inv.status,
        "date": docs.iso(inv.invoice_date),
        "client_name": inv.client_name or "",
        "po_id": _sid(inv.purchase_order_id),
        "po_number": inv.po_number,
        "proposal_id": _sid(inv.proposal_id),
        "linked_client_po_id": _sid(inv.linked_client_po_id),
        "linked_owner_invoice_id": _sid(inv.linked_owner_invoice_id),
        "total": docs.to_num(inv.total),
        "balance_due": docs.to_num(inv.total) - docs.to_num(inv.payments_credits),
        "due_date": docs.iso(due) or "",
        "is_overdue": _is_overdue(inv, due),
        "job_codes": docs.job_codes_of(inv.line_items),
    })


def _apply_payload(db: Session, inv: Invoice, data: InvoicePayload) -> None:
    inv.status = data.status
    inv.invoice_date = docs.require_date(data.date)
    inv.client_name = (data.client_name or "").strip()
    for f in TEXT_FIELDS:
        setattr(inv, f, docs.clean_str(getattr(data, f)))
    inv.purchase_order_id = docs.parse_id(data.po_id)
    inv.proposal_id = docs.parse_id(data.proposal_id)
    inv.ship_date = docs.parse_date(data.ship_date)
    inv.payments_credits = data.payments_credits or 0
    inv.notes = clean_rich_text(data.notes)
    inv.linked_client_po_id = docs.parse_id(data.linked_client_po_id)
    inv.linked_owner_invoice_id = docs.parse_id(data.linked_owner_invoice_id)
    docs.apply_totals(inv, docs.calc_standard_items(data.line_items), data.taxable, data.tax_rate)
    inv.amount = inv.total
    # ERD junctions: issued invoices go to clients, received ones come from subcontractors.
    if inv.direction == "issued":
        inv.clients = docs.matching_clients(db, inv.client_name)
        inv.subcontractors = []
    else:
        inv.subcontractors = docs.matching_subcontractors(db, inv.client_name)
        inv.clients = []


@router.get("")
def list_invoices(
    direction: str,
    q: Optional[str] = None,
    status: Optional[list[str]] = Query(None),
    overdue: bool = False,
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = None,
    client: Optional[str] = None,
    job_code: Optional[list[str]] = Query(None),
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    stmt = select(Invoice).where(Invoice.direction == direction)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(
            Invoice.invoice_number.ilike(like),
            Invoice.po_number.ilike(like),
            Invoice.client_name.ilike(like),
        ))
    if status:
        stmt = stmt.where(Invoice.status.in_(status))
    if from_:
        stmt = stmt.where(Invoice.invoice_date >= docs.parse_date(from_))
    if to:
        stmt = stmt.where(Invoice.invoice_date <= docs.parse_date(to))
    if client:
        stmt = stmt.where(Invoice.client_name.ilike(f"%{client}%"))
    jc = docs.job_code_filter(Invoice.line_items, job_code)
    if jc is not None:
        stmt = stmt.where(jc)
    stmt = stmt.order_by(Invoice.invoice_date.desc(), Invoice.id.desc())
    delays = docs.payment_term_delays(db)
    rows = [serialize_list_item(inv, delays) for inv in db.execute(stmt).scalars()]
    if overdue:
        rows = [r for r in rows if r["is_overdue"]]
    return docs.paginate(rows, page, page_size)


@router.get("/next-number")
def next_number(db: Session = Depends(get_db), _user=Depends(get_current_user)):
    return {"number": docs.next_free_number(db, Invoice.invoice_number, "INV-", Invoice.direction == "issued")}


@router.get("/{invoice_id}")
def get_invoice(invoice_id: str, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    return serialize(docs.get_or_404(db, Invoice, invoice_id, "Invoice"))


@router.post("", status_code=201)
def create_invoice(data: InvoicePayload, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    direction = data.direction or "issued"
    number = docs.clean_str(data.number)
    if number:
        docs.ensure_number_free(db, Invoice, Invoice.invoice_number, number, direction, data.replace_existing, "Invoice")
    else:
        number = docs.next_free_number(db, Invoice.invoice_number, "INV-", Invoice.direction == direction)
    inv = Invoice(invoice_number=number, direction=direction)
    _apply_payload(db, inv, data)
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return serialize(inv)


@router.put("/{invoice_id}")
def update_invoice(invoice_id: str, data: InvoicePayload, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    inv = docs.get_or_404(db, Invoice, invoice_id, "Invoice")
    number = docs.clean_str(data.number) or inv.invoice_number
    if number != inv.invoice_number:
        docs.ensure_number_free(db, Invoice, Invoice.invoice_number, number, inv.direction, data.replace_existing, "Invoice", exclude_id=inv.id)
        inv.invoice_number = number
    _apply_payload(db, inv, data)
    db.commit()
    db.refresh(inv)
    return serialize(inv)


@router.delete("/{invoice_id}", status_code=204)
def delete_invoice(invoice_id: str, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    inv = docs.get_or_404(db, Invoice, invoice_id, "Invoice")
    docs.delete_attachments(db, "invoices", inv.id)
    db.delete(inv)
    db.commit()
    return Response(status_code=204)


@router.patch("/{invoice_id}/status")
def update_status(invoice_id: str, body: StatusPatch, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    inv = docs.get_or_404(db, Invoice, invoice_id, "Invoice")
    inv.status = body.status
    db.commit()
    db.refresh(inv)
    return serialize(inv)


@router.patch("/{invoice_id}/mark-paid")
def mark_paid(invoice_id: str, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    """Quick action: payments_credits = total, status = Paid."""
    inv = docs.get_or_404(db, Invoice, invoice_id, "Invoice")
    inv.payments_credits = inv.total
    inv.status = "Paid"
    db.commit()
    db.refresh(inv)
    return serialize(inv)


@router.get("/{invoice_id}/document")
def generate_document(invoice_id: str, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    inv = docs.get_or_404(db, Invoice, invoice_id, "Invoice")
    return Response(content=docs.placeholder_document("Invoice", inv.invoice_number), media_type="text/plain")
