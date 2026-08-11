"""
Pydantic (v2) schemas. Grouped per entity: Base (shared fields),
Create (input), Update (partial input), and Read (output, includes id).

Nested "Read" schemas intentionally avoid embedding full related-object
lists to prevent deep recursive payloads; use the dedicated relationship
endpoints (e.g. GET /clients/{id}/proposals) to fetch linked records.
"""
from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, EmailStr, ConfigDict


# ---------- Client ----------
class ClientBase(BaseModel):
    name: str
    email: EmailStr


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None


class ClientRead(ClientBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ---------- Subcontractor ----------
class SubcontractorBase(BaseModel):
    name: str
    contact: Optional[str] = None


class SubcontractorCreate(SubcontractorBase):
    pass


class SubcontractorUpdate(BaseModel):
    name: Optional[str] = None
    contact: Optional[str] = None


class SubcontractorRead(SubcontractorBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ---------- Proposal ----------
class ProposalBase(BaseModel):
    reference: str
    status: str = "draft"


class ProposalCreate(ProposalBase):
    pass


class ProposalUpdate(BaseModel):
    reference: Optional[str] = None
    status: Optional[str] = None


class ProposalRead(ProposalBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ---------- Purchase Order ----------
class PurchaseOrderBase(BaseModel):
    po_number: str
    order_date: date
    status: str = "open"
    client_id: int
    proposal_id: Optional[int] = None


class PurchaseOrderCreate(PurchaseOrderBase):
    pass


class PurchaseOrderUpdate(BaseModel):
    po_number: Optional[str] = None
    order_date: Optional[date] = None
    status: Optional[str] = None
    client_id: Optional[int] = None
    proposal_id: Optional[int] = None


class PurchaseOrderRead(PurchaseOrderBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ---------- Invoice ----------
class InvoiceBase(BaseModel):
    invoice_number: str
    invoice_date: date
    amount: Decimal
    purchase_order_id: int


class InvoiceCreate(InvoiceBase):
    pass


class InvoiceUpdate(BaseModel):
    invoice_number: Optional[str] = None
    invoice_date: Optional[date] = None
    amount: Optional[Decimal] = None
    purchase_order_id: Optional[int] = None


class InvoiceRead(InvoiceBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ---------- Job ----------
class JobBase(BaseModel):
    title: str
    description: Optional[str] = None


class JobCreate(JobBase):
    pass


class JobUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None


class JobRead(JobBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ---------- Reference ----------
class ReferenceDocBase(BaseModel):
    value: str


class ReferenceDocCreate(ReferenceDocBase):
    pass


class ReferenceDocUpdate(BaseModel):
    value: Optional[str] = None


class ReferenceDocRead(ReferenceDocBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
