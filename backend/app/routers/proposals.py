"""
Proposals — matches frontend/src/api/proposals.ts.
Issued = clients side (we send it), received = contractors side.
"""
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Proposal
from app.rich_text import clean_rich_text
from app.security import get_current_user, require_write_access
from app.services import documents as docs

router = APIRouter(prefix="/proposals", tags=["proposals"])


class ProposalPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    number: Optional[str] = None
    type: str = "Standard"
    direction: str = "issued"
    status: str
    date: str
    linked_client_po_id: Optional[str] = None
    linked_owner_invoice_id: Optional[str] = None
    client_name: Optional[str] = None
    address: Optional[str] = None
    title: Optional[str] = None
    business_name: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    project_no: Optional[str] = None
    project_name: Optional[str] = None
    agreement_no: Optional[str] = None
    proposal_valid_till: Optional[str] = None
    reference: Optional[str] = None
    project_location: Optional[str] = None
    project_type: Optional[str] = None
    taxable: bool = False
    tax_rate: float = 0
    line_items: list[dict[str, Any]] = []
    notes: Optional[str] = None
    services_provided: Optional[str] = None
    # Set by the frontend's "replace existing" confirm after a 409.
    replace_existing: bool = False


class StatusPatch(BaseModel):
    status: str


TEXT_FIELDS = (
    "client_name", "address", "title", "business_name", "department", "phone", "email",
    "project_no", "project_name", "agreement_no", "reference", "project_location", "project_type",
)


def serialize(p: Proposal) -> dict:
    return docs.drop_none({
        "id": str(p.id),
        "number": p.number,
        "type": p.type,
        "direction": p.direction,
        "status": p.status,
        "date": docs.iso(p.date),
        "linked_client_po_id": str(p.linked_client_po_id) if p.linked_client_po_id else None,
        "linked_owner_invoice_id": str(p.linked_owner_invoice_id) if p.linked_owner_invoice_id else None,
        **{f: getattr(p, f) for f in TEXT_FIELDS},
        "proposal_valid_till": docs.iso(p.proposal_valid_till),
        "taxable": p.taxable,
        "tax_rate": docs.to_num(p.tax_rate),
        "subtotal": docs.to_num(p.subtotal),
        "sales_tax": docs.to_num(p.sales_tax),
        "total": docs.to_num(p.total),
        "line_items": p.line_items or [],
        "notes": p.notes,
        "services_provided": p.services_provided,
        "created_at": docs.iso(p.created_at),
        "updated_at": docs.iso(p.updated_at),
    })


def serialize_list_item(p: Proposal) -> dict:
    return docs.drop_none({
        "id": str(p.id),
        "number": p.number,
        "type": p.type,
        "direction": p.direction,
        "status": p.status,
        "date": docs.iso(p.date),
        "client_name": p.client_name,
        "project_location": p.project_location,
        "project_name": p.project_name,
        "total": docs.to_num(p.total),
        "job_codes": docs.job_codes_of(p.line_items),
    })


def _number_prefix(proposal_type: str) -> str:
    return "PQ-" if proposal_type == "MP" else "Q-"


def _apply_payload(db: Session, p: Proposal, data: ProposalPayload) -> None:
    p.status = data.status
    p.date = docs.require_date(data.date)
    for f in TEXT_FIELDS:
        setattr(p, f, docs.clean_str(getattr(data, f)))
    p.proposal_valid_till = docs.parse_date(data.proposal_valid_till)
    p.linked_client_po_id = docs.parse_id(data.linked_client_po_id)
    p.linked_owner_invoice_id = docs.parse_id(data.linked_owner_invoice_id)
    p.notes = clean_rich_text(data.notes)
    p.services_provided = clean_rich_text(data.services_provided)
    if p.type == "MP":
        items = docs.calc_mp_items(data.line_items)
        docs.apply_totals(p, items, data.taxable, data.tax_rate, amount_key="estimated_fee")
    else:
        items = docs.calc_standard_items(data.line_items)
        docs.apply_totals(p, items, data.taxable, data.tax_rate)
    # ERD junctions: issued proposals go to clients, received ones come from subcontractors.
    if p.direction == "issued":
        p.clients = docs.matching_clients(db, p.client_name)
        p.subcontractors = []
    else:
        p.subcontractors = docs.matching_subcontractors(db, p.client_name)
        p.clients = []


@router.get("")
def list_proposals(
    direction: str,
    q: Optional[str] = None,
    status: Optional[list[str]] = Query(None),
    type: Optional[str] = None,
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = None,
    client: Optional[str] = None,
    job_code: Optional[list[str]] = Query(None),
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    stmt = select(Proposal).where(Proposal.direction == direction)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Proposal.number.ilike(like), Proposal.project_name.ilike(like)))
    if status:
        stmt = stmt.where(Proposal.status.in_(status))
    if type:
        stmt = stmt.where(Proposal.type == type)
    if from_:
        stmt = stmt.where(Proposal.date >= docs.parse_date(from_))
    if to:
        stmt = stmt.where(Proposal.date <= docs.parse_date(to))
    if client:
        like = f"%{client}%"
        stmt = stmt.where(or_(Proposal.client_name.ilike(like), Proposal.project_location.ilike(like)))
    jc = docs.job_code_filter(Proposal.line_items, job_code)
    if jc is not None:
        stmt = stmt.where(jc)
    stmt = stmt.order_by(Proposal.date.desc(), Proposal.id.desc())
    rows = [serialize_list_item(p) for p in db.execute(stmt).scalars()]
    return docs.paginate(rows, page, page_size)


@router.get("/next-number")
def next_number(type: str = "standard", db: Session = Depends(get_db), _user=Depends(get_current_user)):
    prefix = "PQ-" if type.lower() == "mp" else "Q-"
    return {"number": docs.next_free_number(db, Proposal.number, prefix, Proposal.direction == "issued")}


@router.get("/{proposal_id}")
def get_proposal(proposal_id: str, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    return serialize(docs.get_or_404(db, Proposal, proposal_id, "Proposal"))


@router.post("", status_code=201)
def create_proposal(data: ProposalPayload, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    direction = data.direction or "issued"
    number = docs.clean_str(data.number)
    if number:
        docs.ensure_number_free(db, Proposal, Proposal.number, number, direction, data.replace_existing, "Proposal")
    else:
        number = docs.next_free_number(db, Proposal.number, _number_prefix(data.type), Proposal.direction == direction)
    p = Proposal(number=number, type=data.type, direction=direction)
    _apply_payload(db, p, data)
    db.add(p)
    db.commit()
    db.refresh(p)
    return serialize(p)


@router.put("/{proposal_id}")
def update_proposal(proposal_id: str, data: ProposalPayload, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    p = docs.get_or_404(db, Proposal, proposal_id, "Proposal")
    if data.type != p.type:
        raise HTTPException(status_code=400, detail={"message": "Type cannot be changed"})
    number = docs.clean_str(data.number) or p.number
    if number != p.number:
        docs.ensure_number_free(db, Proposal, Proposal.number, number, p.direction, data.replace_existing, "Proposal", exclude_id=p.id)
        p.number = number
    _apply_payload(db, p, data)
    db.commit()
    db.refresh(p)
    return serialize(p)


@router.delete("/{proposal_id}", status_code=204)
def delete_proposal(proposal_id: str, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    p = docs.get_or_404(db, Proposal, proposal_id, "Proposal")
    docs.delete_attachments(db, "proposals", p.id)
    db.delete(p)
    db.commit()
    return Response(status_code=204)


@router.patch("/{proposal_id}/status")
def update_status(proposal_id: str, body: StatusPatch, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    p = docs.get_or_404(db, Proposal, proposal_id, "Proposal")
    p.status = body.status
    db.commit()
    db.refresh(p)
    return serialize(p)


@router.get("/{proposal_id}/document")
def generate_document(proposal_id: str, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    p = docs.get_or_404(db, Proposal, proposal_id, "Proposal")
    return Response(content=docs.placeholder_document("Proposal Document", p.number), media_type="text/plain")


@router.get("/{proposal_id}/preview")
def preview_document(proposal_id: str, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    docs.get_or_404(db, Proposal, proposal_id, "Proposal")
    return None
