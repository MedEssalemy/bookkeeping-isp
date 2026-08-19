from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.security import get_current_user, require_write_access
from app import crud
from app.schemas import schemas
from app.routers.factory import build_crud_router

router = build_crud_router(
    prefix="/purchase-orders",
    tags=["purchase-orders"],
    crud_obj=crud.purchase_order,
    read_schema=schemas.PurchaseOrderRead,
    create_schema=schemas.PurchaseOrderCreate,
    update_schema=schemas.PurchaseOrderUpdate,
)


def _toggle(collection: list, item, add: bool, db: Session):
    if add and item not in collection:
        collection.append(item)
        db.commit()
    elif not add and item in collection:
        collection.remove(item)
        db.commit()


# ---- PURCHASE_ORDER ||--|{ INVOICE : "bills" (direct FK, read-only convenience) ----
@router.get("/{po_id}/invoices", response_model=list[schemas.InvoiceRead])
def list_po_invoices(po_id: int, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    return crud.purchase_order.get(db, po_id).invoices


# ---- PURCHASE_ORDER }o--o{ JOB : "includes" ----
@router.get("/{po_id}/jobs", response_model=list[schemas.JobRead])
def list_po_jobs(po_id: int, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    return crud.purchase_order.get(db, po_id).jobs


@router.post("/{po_id}/jobs/{job_id}", status_code=204)
def link_po_job(po_id: int, job_id: int, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    po = crud.purchase_order.get(db, po_id)
    _toggle(po.jobs, crud.job.get(db, job_id), True, db)
    return None


@router.delete("/{po_id}/jobs/{job_id}", status_code=204)
def unlink_po_job(po_id: int, job_id: int, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    po = crud.purchase_order.get(db, po_id)
    _toggle(po.jobs, crud.job.get(db, job_id), False, db)
    return None
