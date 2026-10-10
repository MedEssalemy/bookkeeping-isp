from sqlalchemy import Column, Integer, String, Date, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base
from app.models._doc_columns import (
    money, tax_rate, taxable, line_items, opt_str, text, created_at, updated_at,
)


class Proposal(Base):
    __tablename__ = "proposals"
    __table_args__ = (UniqueConstraint("number", "direction", name="uq_proposals_number_direction"),)

    id = Column(Integer, primary_key=True, index=True)
    number = Column(String(100), nullable=False)
    type = Column(String(20), nullable=False, default="Standard")          # Standard | MP
    direction = Column(String(20), nullable=False, default="issued")       # issued | received
    status = Column(String(50), nullable=False, default="Draft")
    date = Column(Date, nullable=False)

    # Engagement links (received only, optional)
    linked_client_po_id = Column(Integer, ForeignKey("purchase_orders.id", ondelete="SET NULL", use_alter=True), nullable=True)
    linked_owner_invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="SET NULL", use_alter=True), nullable=True)

    # Counterparty snapshot (Standard)
    client_name = opt_str()
    address = opt_str(400)
    title = opt_str(100)
    business_name = opt_str()
    department = opt_str(100)
    phone = opt_str(50)
    email = opt_str()
    project_no = opt_str(100)
    project_name = opt_str()
    agreement_no = opt_str(100)
    proposal_valid_till = Column(Date, nullable=True)

    # MP fields. `reference` is the MP Reference label (config list "references").
    reference = opt_str()
    project_location = opt_str()
    project_type = opt_str()

    taxable = taxable()
    tax_rate = tax_rate()
    subtotal = money()
    sales_tax = money()
    total = money()
    line_items = line_items()
    notes = text()
    services_provided = text()

    created_at = created_at()
    updated_at = updated_at()

    # CLIENT }o--o{ PROPOSAL : "receives"
    clients = relationship(
        "Client", secondary="client_proposals", back_populates="proposals"
    )

    # SUBCONTRACTOR }o--o{ PROPOSAL : "sends"
    subcontractors = relationship(
        "Subcontractor", secondary="subcontractor_proposals", back_populates="proposals"
    )

    # PURCHASE_ORDER ||--o| PROPOSAL : "follows"
    purchase_order = relationship(
        "PurchaseOrder", back_populates="proposal", uselist=False,
        foreign_keys="PurchaseOrder.proposal_id",
    )

    # PROPOSAL |o--o{ INVOICE : "bills directly" (no PO in between)
    direct_invoices = relationship(
        "Invoice", back_populates="proposal", foreign_keys="Invoice.proposal_id",
    )

    # PROPOSAL }o--o{ JOB : "covers"
    jobs = relationship(
        "Job", secondary="proposal_jobs", back_populates="proposals"
    )

    # Reference }o--o{ PROPOSAL (MP only)
    reference_docs = relationship(
        "ReferenceDoc", secondary="reference_proposals", back_populates="proposals"
    )
