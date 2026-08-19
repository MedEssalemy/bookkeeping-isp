from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.security import get_current_user, require_write_access
from app import crud
from app.schemas import schemas
from app.routers.factory import build_crud_router

router = build_crud_router(
    prefix="/clients",
    tags=["clients"],
    crud_obj=crud.client,
    read_schema=schemas.ClientRead,
    create_schema=schemas.ClientCreate,
    update_schema=schemas.ClientUpdate,
)

# ---- CLIENT }o--o{ PROPOSAL : "receives" ----
@router.get("/{client_id}/proposals", response_model=list[schemas.ProposalRead])
def list_client_proposals(client_id: int, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    return crud.client.get(db, client_id).proposals


@router.post("/{client_id}/proposals/{proposal_id}", status_code=204)
def link_client_proposal(client_id: int, proposal_id: int, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    c = crud.client.get(db, client_id)
    p = crud.proposal.get(db, proposal_id)
    if p not in c.proposals:
        c.proposals.append(p)
        db.commit()
    return None


@router.delete("/{client_id}/proposals/{proposal_id}", status_code=204)
def unlink_client_proposal(client_id: int, proposal_id: int, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    c = crud.client.get(db, client_id)
    p = crud.proposal.get(db, proposal_id)
    if p in c.proposals:
        c.proposals.remove(p)
        db.commit()
    return None


# ---- CLIENT }o--o{ INVOICE : "receives" ----
@router.get("/{client_id}/invoices", response_model=list[schemas.InvoiceRead])
def list_client_invoices(client_id: int, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    return crud.client.get(db, client_id).invoices


@router.post("/{client_id}/invoices/{invoice_id}", status_code=204)
def link_client_invoice(client_id: int, invoice_id: int, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    c = crud.client.get(db, client_id)
    i = crud.invoice.get(db, invoice_id)
    if i not in c.invoices:
        c.invoices.append(i)
        db.commit()
    return None


@router.delete("/{client_id}/invoices/{invoice_id}", status_code=204)
def unlink_client_invoice(client_id: int, invoice_id: int, db: Session = Depends(get_db), _user=Depends(require_write_access)):
    c = crud.client.get(db, client_id)
    i = crud.invoice.get(db, invoice_id)
    if i in c.invoices:
        c.invoices.remove(i)
        db.commit()
    return None


# ---- CLIENT ||--o{ PURCHASE_ORDER : "sends" (direct FK, read-only convenience) ----
@router.get("/{client_id}/purchase-orders", response_model=list[schemas.PurchaseOrderRead])
def list_client_purchase_orders(client_id: int, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    return crud.client.get(db, client_id).purchase_orders
