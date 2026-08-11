"""
Import every model here so that Base.metadata is fully populated
when Alembic (or Base.metadata.create_all) inspects it.
"""
from app.models.client import Client
from app.models.subcontractor import Subcontractor
from app.models.proposal import Proposal
from app.models.purchase_order import PurchaseOrder
from app.models.invoice import Invoice
from app.models.job import Job
from app.models.reference import ReferenceDoc
from app.models.associations import (
    client_proposals,
    client_invoices,
    subcontractor_proposals,
    subcontractor_purchase_orders,
    subcontractor_invoices,
    purchase_order_jobs,
    proposal_jobs,
    job_subcontractors,
    job_invoices,
    reference_proposals,
)

__all__ = [
    "Client",
    "Subcontractor",
    "Proposal",
    "PurchaseOrder",
    "Invoice",
    "Job",
    "ReferenceDoc",
    "client_proposals",
    "client_invoices",
    "subcontractor_proposals",
    "subcontractor_purchase_orders",
    "subcontractor_invoices",
    "purchase_order_jobs",
    "proposal_jobs",
    "job_subcontractors",
    "job_invoices",
    "reference_proposals",
]
