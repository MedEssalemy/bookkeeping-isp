from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app import crud
from app.schemas import schemas
from app.routers.factory import build_crud_router

router = build_crud_router(
    prefix="/subcontractors",
    tags=["subcontractors"],
    crud_obj=crud.subcontractor,
    read_schema=schemas.SubcontractorRead,
    create_schema=schemas.SubcontractorCreate,
    update_schema=schemas.SubcontractorUpdate,
)


def _toggle(collection: list, item, add: bool, db: Session):
    if add and item not in collection:
        collection.append(item)
        db.commit()
    elif not add and item in collection:
        collection.remove(item)
        db.commit()


# ---- SUBCONTRACTOR }o--o{ PROPOSAL : "sends" ----
@router.get("/{sub_id}/proposals", response_model=list[schemas.ProposalRead])
def list_sub_proposals(sub_id: int, db: Session = Depends(get_db)):
    return crud.subcontractor.get(db, sub_id).proposals


@router.post("/{sub_id}/proposals/{proposal_id}", status_code=204)
def link_sub_proposal(sub_id: int, proposal_id: int, db: Session = Depends(get_db)):
    s = crud.subcontractor.get(db, sub_id)
    _toggle(s.proposals, crud.proposal.get(db, proposal_id), True, db)
    return None


@router.delete("/{sub_id}/proposals/{proposal_id}", status_code=204)
def unlink_sub_proposal(sub_id: int, proposal_id: int, db: Session = Depends(get_db)):
    s = crud.subcontractor.get(db, sub_id)
    _toggle(s.proposals, crud.proposal.get(db, proposal_id), False, db)
    return None


# ---- SUBCONTRACTOR }o--o{ PURCHASE_ORDER : "receives" ----
@router.get("/{sub_id}/purchase-orders", response_model=list[schemas.PurchaseOrderRead])
def list_sub_purchase_orders(sub_id: int, db: Session = Depends(get_db)):
    return crud.subcontractor.get(db, sub_id).purchase_orders


@router.post("/{sub_id}/purchase-orders/{po_id}", status_code=204)
def link_sub_purchase_order(sub_id: int, po_id: int, db: Session = Depends(get_db)):
    s = crud.subcontractor.get(db, sub_id)
    _toggle(s.purchase_orders, crud.purchase_order.get(db, po_id), True, db)
    return None


@router.delete("/{sub_id}/purchase-orders/{po_id}", status_code=204)
def unlink_sub_purchase_order(sub_id: int, po_id: int, db: Session = Depends(get_db)):
    s = crud.subcontractor.get(db, sub_id)
    _toggle(s.purchase_orders, crud.purchase_order.get(db, po_id), False, db)
    return None


# ---- SUBCONTRACTOR }o--o{ INVOICE : "sends" ----
@router.get("/{sub_id}/invoices", response_model=list[schemas.InvoiceRead])
def list_sub_invoices(sub_id: int, db: Session = Depends(get_db)):
    return crud.subcontractor.get(db, sub_id).invoices


@router.post("/{sub_id}/invoices/{invoice_id}", status_code=204)
def link_sub_invoice(sub_id: int, invoice_id: int, db: Session = Depends(get_db)):
    s = crud.subcontractor.get(db, sub_id)
    _toggle(s.invoices, crud.invoice.get(db, invoice_id), True, db)
    return None


@router.delete("/{sub_id}/invoices/{invoice_id}", status_code=204)
def unlink_sub_invoice(sub_id: int, invoice_id: int, db: Session = Depends(get_db)):
    s = crud.subcontractor.get(db, sub_id)
    _toggle(s.invoices, crud.invoice.get(db, invoice_id), False, db)
    return None


# ---- JOB }o--o{ SUBCONTRACTOR : "handles" ----
@router.get("/{sub_id}/jobs", response_model=list[schemas.JobRead])
def list_sub_jobs(sub_id: int, db: Session = Depends(get_db)):
    return crud.subcontractor.get(db, sub_id).jobs


@router.post("/{sub_id}/jobs/{job_id}", status_code=204)
def link_sub_job(sub_id: int, job_id: int, db: Session = Depends(get_db)):
    s = crud.subcontractor.get(db, sub_id)
    _toggle(s.jobs, crud.job.get(db, job_id), True, db)
    return None


@router.delete("/{sub_id}/jobs/{job_id}", status_code=204)
def unlink_sub_job(sub_id: int, job_id: int, db: Session = Depends(get_db)):
    s = crud.subcontractor.get(db, sub_id)
    _toggle(s.jobs, crud.job.get(db, job_id), False, db)
    return None
