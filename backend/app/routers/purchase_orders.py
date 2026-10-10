"""
Purchase orders — matches frontend/src/api/purchaseOrders.ts (mounted at /pos).
Received = clients side (client's PO to us), issued = contractors side.
"""
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import PurchaseOrder, Invoice
from app.rich_text import clean_rich_text
from app.security import get_current_user, require_write_access
from app.services import documents as docs

router = APIRouter(prefix="/pos", tags=["purchase-orders"])


class POPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    number: Optional[str] = None
    direction: str = "received"
    status: str
    date: str
    proposal_id: Optional[str] = None
    proposal_number: Optional[str] = None
    client_name: str = ""
    address: Optional[str] = None
    project_no: Optional[str] = None
    agreement_no: Optional[str] = None
    ship_date: Optional[str] = None
    ship_to: Optional[str] = None
    payment_terms: Optional[str] = None
    taxable: bool = False
    tax_rate: float = 0
    line_items: list[dict[str, Any]] = []
    notes: Optional[str] = None
    linked_client_po_id: Optional[str] = None
    linked_owner_invoice_id: Optional[str] = None
    replace_existing: bool = False


class StatusPatch(BaseModel):
    status: str


TEXT_FIELDS = ("proposal_number", "address", "project_no", "agreement_no", "ship_to", "payment_terms")


def _sid(v: int | None) -> str | None:
    return str(v) if v else None


def serialize(p: PurchaseOrder) -> dict:
    return docs.drop_none({
        "id": str(p.id),
        "direction": p.direction,
        "number": p.po_number,
        "status": p.status,
        "date": docs.iso(p.order_date),
        "proposal_id": _sid(p.proposal_id),
        "client_name": p.client_name or "",
        **{f: getattr(p, f) for f in TEXT_FIELDS},
        "ship_date": docs.iso(p.ship_date),
        "taxable": p.taxable,
        "tax_rate": docs.to_num(p.tax_rate),
        "subtotal": docs.to_num(p.subtotal),
        "sales_tax": docs.to_num(p.sales_tax),
        "total": docs.to_num(p.total),
        "line_items": p.line_items or [],
        "notes": p.notes,
        "linked_client_po_id": _sid(p.linked_client_po_id),
        "linked_owner_invoice_id": _sid(p.linked_owner_invoice_id),
        "created_at": docs.iso(p.created_at),
        "updated_at": docs.iso(p.updated_at),
    })


def serialize_list_item(p: PurchaseOrder) -> dict:
    return docs.drop_none({
        "id": str(p.id),
        "number": p.po_number,
        "direction": p.direction,
        "status": p.status,
        "date": docs.iso(p.order_date),
        "client_name": p.client_name or "",
        "proposal_id": _sid(p.proposal_id),
        "proposal_number": p.proposal_number,
        "total": docs.to_num(p.total),
        "job_codes": docs.job_codes_of(p.line_items),
    })


def _apply_payload(db: Session, p: PurchaseOrder, data: POPayload) -> None:
    p.status = data.status
    p.order_date = docs.require_date(data.date)
    p.client_name = (data.client_name or "").strip()
    for f in TEXT_FIELDS:
        setattr(p, f, docs.clean_str(getattr(data, f)))
    p.proposal_id = docs.parse_id(data.proposal_id)
    p.ship_date = docs.parse_date(data.ship_date)
    p.notes = clean_rich_text(data.notes)
    p.linked_client_po_id = docs.parse_id(data.linked_client_po_id)
    p.linked_owner_invoice_id = docs.parse_id(data.linked_owner_invoice_id)
    docs.apply_totals(p, docs.calc_standard_items(data.line_items), data.taxable, data.tax_rate)
    # ERD links: a received PO is sent by a client; an issued PO goes to subcontractors.
    if p.direction == "received":
        clients = docs.matching_clients(db, p.client_name)
        p.client_id = clients[0].id if clients else None
        p.subcontractors = []
    else:
        p.client_id = None
        p.subcontractors = docs.matching_subcontractors(db, p.client_name)


def _linked_invoice_ids(db: Session, po_id: int) -> list[str]:
    ids = db.execute(select(Invoice.id).where(Invoice.purchase_order_id == po_id).order_by(Invoice.id)).scalars()
    return [str(i) for i in ids]


@router.get("")
def list_pos(
    direction: str,
    q: Optional[str] = None,
    status: Optional[list[str]] = Query(None),
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = None,
    client: Optional[str] = None,
    job_code: Optional[list[str]] = Query(None),
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    stmt = select(PurchaseOrder).where(PurchaseOrder.direction == direction)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(
            PurchaseOrder.po_number.ilike(like),
            PurchaseOrder.proposal_number.ilike(like),
            PurchaseOrder.client_name.ilike(like),
        ))
    if status:
        stmt = stmt.where(PurchaseOrder.status.in_(status))
    if from_:
        stmt = stmt.where(PurchaseOrder.order_date >= docs.parse_date(from_))
    if to:
        stmt = stmt.where(PurchaseOrder.order_date <= docs.parse_date(to))
    if client:
        stmt = stmt.where(PurchaseOrder.client_name.ilike(f"%{client}%"))
    jc = docs.job_code_filter(PurchaseOrder.line_items, job_code)
    if jc is not None:
        stmt = stmt.where(jc)
    stmt = stmt.order_by(PurchaseOrder.order_date.desc(), PurchaseOrder.id.desc())
    rows = [serialize_list_item(p) for p in db.execute(stmt).scalars()]
    return docs.paginate(rows, page, page_size)


@router.get("/next-number")
def next_number(db: Session = Depends(get_db), _user=Depends(get_current_user)):
    return {"number": docs.next_free_number(db, PurchaseOrder.po_number, "PO-", PurchaseOrder.direction == "issued")}


@router.get("/{po_id}")
def get_po(po_id: str, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    return serialize(docs.get_or_404(db, PurchaseOrder, po_id, "Purchase order"))


@router.get("/{po_id}/linked-invoices")
def linked_invoices(po_id: str, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    p = docs.get_or_404(db, PurchaseOrder, po_id, "Purchase order")
    return _linked_invoice_ids(db, p.id)


@router.post("", status_code=201)
def create_po(data: POPayload, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    direction = data.direction or "received"
    number = docs.clean_str(data.number)
    if number:
        docs.ensure_number_free(db, PurchaseOrder, PurchaseOrder.po_number, number, direction, data.replace_existing, "PO")
    else:
        number = docs.next_free_number(db, PurchaseOrder.po_number, "PO-", PurchaseOrder.direction == direction)
    p = PurchaseOrder(po_number=number, direction=direction)
    _apply_payload(db, p, data)
    db.add(p)
    db.commit()
    db.refresh(p)
    return serialize(p)


@router.put("/{po_id}")
def update_po(po_id: str, data: POPayload, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    p = docs.get_or_404(db, PurchaseOrder, po_id, "Purchase order")
    number = docs.clean_str(data.number) or p.po_number
    if number != p.po_number:
        docs.ensure_number_free(db, PurchaseOrder, PurchaseOrder.po_number, number, p.direction, data.replace_existing, "PO", exclude_id=p.id)
        p.po_number = number
    _apply_payload(db, p, data)
    db.commit()
    db.refresh(p)
    return serialize(p)


@router.delete("/{po_id}", status_code=204)
def delete_po(po_id: str, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    p = docs.get_or_404(db, PurchaseOrder, po_id, "Purchase order")
    linked = _linked_invoice_ids(db, p.id)
    if linked:
        raise HTTPException(status_code=409, detail={"message": "PO has linked invoices", "linked": linked})
    docs.delete_attachments(db, "pos", p.id)
    db.delete(p)
    db.commit()
    return Response(status_code=204)


@router.patch("/{po_id}/status")
def update_status(po_id: str, body: StatusPatch, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    p = docs.get_or_404(db, PurchaseOrder, po_id, "Purchase order")
    p.status = body.status
    db.commit()
    db.refresh(p)
    return serialize(p)


@router.get("/{po_id}/document")
def generate_document(po_id: str, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    p = docs.get_or_404(db, PurchaseOrder, po_id, "Purchase order")
    return Response(content=docs.placeholder_document("Purchase Order", p.po_number), media_type="text/plain")
