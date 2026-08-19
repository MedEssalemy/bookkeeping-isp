from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.security import get_current_user, require_write_access
from app import crud
from app.schemas import schemas
from app.routers.factory import build_crud_router

router = build_crud_router(
    prefix="/proposals",
    tags=["proposals"],
    crud_obj=crud.proposal,
    read_schema=schemas.ProposalRead,
    create_schema=schemas.ProposalCreate,
    update_schema=schemas.ProposalUpdate,
)


def _toggle(collection: list, item, add: bool, db: Session):
    if add and item not in collection:
        collection.append(item)
        db.commit()
    elif not add and item in collection:
        collection.remove(item)
        db.commit()


# ---- PROPOSAL }o--o{ JOB : "covers" ----
@router.get("/{proposal_id}/jobs", response_model=list[schemas.JobRead])
def list_proposal_jobs(proposal_id: int, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    return crud.proposal.get(db, proposal_id).jobs


@router.post("/{proposal_id}/jobs/{job_id}", status_code=204)
def link_proposal_job(proposal_id: int, job_id: int, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    p = crud.proposal.get(db, proposal_id)
    _toggle(p.jobs, crud.job.get(db, job_id), True, db)
    return None


@router.delete("/{proposal_id}/jobs/{job_id}", status_code=204)
def unlink_proposal_job(proposal_id: int, job_id: int, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    p = crud.proposal.get(db, proposal_id)
    _toggle(p.jobs, crud.job.get(db, job_id), False, db)
    return None


# ---- Reference }o--o{ PROPOSAL ----
@router.get("/{proposal_id}/references", response_model=list[schemas.ReferenceDocRead])
def list_proposal_references(proposal_id: int, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    return crud.proposal.get(db, proposal_id).reference_docs


@router.post("/{proposal_id}/references/{reference_id}", status_code=204)
def link_proposal_reference(proposal_id: int, reference_id: int, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    p = crud.proposal.get(db, proposal_id)
    _toggle(p.reference_docs, crud.reference_doc.get(db, reference_id), True, db)
    return None


@router.delete("/{proposal_id}/references/{reference_id}", status_code=204)
def unlink_proposal_reference(proposal_id: int, reference_id: int, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    p = crud.proposal.get(db, proposal_id)
    _toggle(p.reference_docs, crud.reference_doc.get(db, reference_id), False, db)
    return None
