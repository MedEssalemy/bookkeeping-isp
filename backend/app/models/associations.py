"""
Pure many-to-many junction tables (Mermaid `}o--o{` relationships in the ERD).

Direct one-to-many / one-to-one relationships are modeled as plain foreign
keys on the "many" / "optional" side instead (see client.py, purchase_order.py,
invoice.py) — they don't need a junction table.

ERD relationship -> table:
  CLIENT }o--o{ PROPOSAL          "receives"  -> client_proposals
  CLIENT }o--o{ INVOICE           "receives"  -> client_invoices
  SUBCONTRACTOR }o--o{ PROPOSAL   "sends"     -> subcontractor_proposals
  SUBCONTRACTOR }o--o{ PURCHASE_ORDER "receives" -> subcontractor_purchase_orders
  SUBCONTRACTOR }o--o{ INVOICE    "sends"     -> subcontractor_invoices
  PURCHASE_ORDER }o--o{ JOB       "includes"  -> purchase_order_jobs
  PROPOSAL }o--o{ JOB             "covers"    -> proposal_jobs
  JOB }o--o{ SUBCONTRACTOR        "handles"   -> job_subcontractors
  JOB }o--o{ INVOICE              "charges"   -> job_invoices
  Reference }o--o{ PROPOSAL       (MP only)   -> reference_proposals
"""
from sqlalchemy import Table, Column, ForeignKey
from app.database import Base

client_proposals = Table(
    "client_proposals",
    Base.metadata,
    Column("client_id", ForeignKey("clients.id", ondelete="CASCADE"), primary_key=True),
    Column("proposal_id", ForeignKey("proposals.id", ondelete="CASCADE"), primary_key=True),
)

client_invoices = Table(
    "client_invoices",
    Base.metadata,
    Column("client_id", ForeignKey("clients.id", ondelete="CASCADE"), primary_key=True),
    Column("invoice_id", ForeignKey("invoices.id", ondelete="CASCADE"), primary_key=True),
)

subcontractor_proposals = Table(
    "subcontractor_proposals",
    Base.metadata,
    Column("subcontractor_id", ForeignKey("subcontractors.id", ondelete="CASCADE"), primary_key=True),
    Column("proposal_id", ForeignKey("proposals.id", ondelete="CASCADE"), primary_key=True),
)

subcontractor_purchase_orders = Table(
    "subcontractor_purchase_orders",
    Base.metadata,
    Column("subcontractor_id", ForeignKey("subcontractors.id", ondelete="CASCADE"), primary_key=True),
    Column("purchase_order_id", ForeignKey("purchase_orders.id", ondelete="CASCADE"), primary_key=True),
)

subcontractor_invoices = Table(
    "subcontractor_invoices",
    Base.metadata,
    Column("subcontractor_id", ForeignKey("subcontractors.id", ondelete="CASCADE"), primary_key=True),
    Column("invoice_id", ForeignKey("invoices.id", ondelete="CASCADE"), primary_key=True),
)

purchase_order_jobs = Table(
    "purchase_order_jobs",
    Base.metadata,
    Column("purchase_order_id", ForeignKey("purchase_orders.id", ondelete="CASCADE"), primary_key=True),
    Column("job_id", ForeignKey("jobs.id", ondelete="CASCADE"), primary_key=True),
)

proposal_jobs = Table(
    "proposal_jobs",
    Base.metadata,
    Column("proposal_id", ForeignKey("proposals.id", ondelete="CASCADE"), primary_key=True),
    Column("job_id", ForeignKey("jobs.id", ondelete="CASCADE"), primary_key=True),
)

job_subcontractors = Table(
    "job_subcontractors",
    Base.metadata,
    Column("job_id", ForeignKey("jobs.id", ondelete="CASCADE"), primary_key=True),
    Column("subcontractor_id", ForeignKey("subcontractors.id", ondelete="CASCADE"), primary_key=True),
)

job_invoices = Table(
    "job_invoices",
    Base.metadata,
    Column("job_id", ForeignKey("jobs.id", ondelete="CASCADE"), primary_key=True),
    Column("invoice_id", ForeignKey("invoices.id", ondelete="CASCADE"), primary_key=True),
)

reference_proposals = Table(
    "reference_proposals",
    Base.metadata,
    Column("reference_id", ForeignKey("reference_docs.id", ondelete="CASCADE"), primary_key=True),
    Column("proposal_id", ForeignKey("proposals.id", ondelete="CASCADE"), primary_key=True),
)
