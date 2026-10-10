from fastapi import Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.security import get_current_user, require_write_access
from app import crud
from app.schemas import schemas
from app.routers.factory import build_crud_router

router = build_crud_router(
    prefix="/jobs",
    tags=["jobs"],
    crud_obj=crud.job,
    read_schema=schemas.JobRead,
    create_schema=schemas.JobCreate,
    update_schema=schemas.JobUpdate,
)


def _toggle(collection: list, item, add: bool, db: Session):
    if add and item not in collection:
        collection.append(item)
        db.commit()
    elif not add and item in collection:
        collection.remove(item)
        db.commit()


# ---- JOB }o--o{ INVOICE : "charges" (direct relation, used when there is no PO) ----
@router.get("/{job_id}/invoices", response_model=list[schemas.InvoiceRead])
def list_job_invoices(job_id: int, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    return crud.job.get(db, job_id).invoices


@router.post("/{job_id}/invoices/{invoice_id}", status_code=204)
def link_job_invoice(job_id: int, invoice_id: int, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    j = crud.job.get(db, job_id)
    _toggle(j.invoices, crud.invoice.get(db, invoice_id), True, db)
    return None


@router.delete("/{job_id}/invoices/{invoice_id}", status_code=204)
def unlink_job_invoice(job_id: int, invoice_id: int, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    j = crud.job.get(db, job_id)
    _toggle(j.invoices, crud.invoice.get(db, invoice_id), False, db)
    return None
