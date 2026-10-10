"""
Clients (one row per contact person / facility) — matches frontend/src/api/clients.ts.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Client
from app.security import get_current_user, require_write_access
from app.services import parties
from app.services.parties import ContactInput, ImportPlan

router = APIRouter(prefix="/clients", tags=["clients"])


@router.get("/names")
def search_names(q: str = "", db: Session = Depends(get_db), _user=Depends(get_current_user)):
    return parties.search_names(db, Client, q)


@router.get("/lookup")
def lookup(name: str, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    return parties.lookup(db, Client, name)


@router.get("/contacts/all")
def list_all_contacts(db: Session = Depends(get_db), _user=Depends(get_current_user)):
    return parties.list_all(db, Client)


@router.post("/contacts", status_code=201)
def add_contact(data: ContactInput, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    return parties.create(db, Client, data)


@router.put("/contacts/{contact_id}")
def update_contact(contact_id: str, data: ContactInput, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    return parties.update(db, Client, contact_id, data, "Contact")


@router.delete("/contacts/{contact_id}")
def delete_contact(contact_id: str, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    row = parties.get_or_404(db, Client, contact_id, "Contact")
    db.delete(row)
    db.commit()
    return {"id": contact_id}


@router.post("/import")
def commit_import(plan: ImportPlan, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    return parties.commit_import(db, Client, plan)
