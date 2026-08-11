from app.crud.base import CRUDBase
from app.models import (
    Client, Subcontractor, Proposal, PurchaseOrder, Invoice, Job, ReferenceDoc,
)
from app.schemas.schemas import (
    ClientCreate, ClientUpdate,
    SubcontractorCreate, SubcontractorUpdate,
    ProposalCreate, ProposalUpdate,
    PurchaseOrderCreate, PurchaseOrderUpdate,
    InvoiceCreate, InvoiceUpdate,
    JobCreate, JobUpdate,
    ReferenceDocCreate, ReferenceDocUpdate,
)

client = CRUDBase[Client, ClientCreate, ClientUpdate](Client)
subcontractor = CRUDBase[Subcontractor, SubcontractorCreate, SubcontractorUpdate](Subcontractor)
proposal = CRUDBase[Proposal, ProposalCreate, ProposalUpdate](Proposal)
purchase_order = CRUDBase[PurchaseOrder, PurchaseOrderCreate, PurchaseOrderUpdate](PurchaseOrder)
invoice = CRUDBase[Invoice, InvoiceCreate, InvoiceUpdate](Invoice)
job = CRUDBase[Job, JobCreate, JobUpdate](Job)
reference_doc = CRUDBase[ReferenceDoc, ReferenceDocCreate, ReferenceDocUpdate](ReferenceDoc)
