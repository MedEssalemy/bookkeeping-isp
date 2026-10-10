"""
Contractors (the ERD's SUBCONTRACTOR entity) — matches frontend/src/api/contractors.ts.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Subcontractor, PurchaseOrder, Invoice, Proposal
from app.security import get_current_user, require_write_access
from app.services import parties
from app.services.parties import ContactInput, ImportPlan

router = APIRouter(prefix="/contractors", tags=["contractors"])


def _reference_count(db: Session, name: str) -> int:
    """Documents naming this contractor as counterparty: issued POs,
    received invoices and received proposals."""
    key = name.strip().lower()
    total = 0
    for model, direction in ((PurchaseOrder, "issued"), (Invoice, "received"), (Proposal, "received")):
        total += db.execute(
            select(func.count()).select_from(model).where(
                model.direction == direction,
                func.lower(func.trim(model.client_name)) == key,
            )
        ).scalar_one()
    return total


@router.get("/names")
def search_names(q: str = "", db: Session = Depends(get_db), _user=Depends(get_current_user)):
    return parties.search_names(db, Subcontractor, q)


@router.get("/lookup")
def lookup(name: str, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    return parties.lookup(db, Subcontractor, name)


@router.get("/all")
def list_all(db: Session = Depends(get_db), _user=Depends(get_current_user)):
    return parties.list_all(db, Subcontractor)


@router.post("", status_code=201)
def add_contractor(data: ContactInput, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    return parties.create(db, Subcontractor, data)


@router.post("/import")
def commit_import(plan: ImportPlan, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    return parties.commit_import(db, Subcontractor, plan)


@router.put("/{contractor_id}")
def update_contractor(contractor_id: str, data: ContactInput, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    return parties.update(db, Subcontractor, contractor_id, data, "Contractor")


@router.delete("/{contractor_id}")
def delete_contractor(contractor_id: str, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    row = parties.get_or_404(db, Subcontractor, contractor_id, "Contractor")
    count = _reference_count(db, row.name)
    if count > 0:
        raise HTTPException(status_code=409, detail={"message": "Contractor is referenced by documents", "count": count})
    db.delete(row)
    db.commit()
    return {"id": contractor_id}
