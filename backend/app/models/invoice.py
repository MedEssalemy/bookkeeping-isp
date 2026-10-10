from sqlalchemy import Column, Integer, String, Date, Numeric, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base
from app.models._doc_columns import (
    money, tax_rate, taxable, line_items, opt_str, text, created_at, updated_at,
)


class Invoice(Base):
    __tablename__ = "invoices"
    __table_args__ = (UniqueConstraint("invoice_number", "direction", name="uq_invoices_number_direction"),)

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(100), nullable=False)   # API field: number
    invoice_date = Column(Date, nullable=False)            # API field: date
    amount = Column(Numeric(12, 2), nullable=False)        # mirrors total
    direction = Column(String(20), nullable=False, default="issued")
    status = Column(String(50), nullable=False, default="Draft")

    # PURCHASE_ORDER |o--o{ INVOICE : "bills" (API field: po_id)
    purchase_order_id = Column(
        Integer, ForeignKey("purchase_orders.id", ondelete="SET NULL"), nullable=True
    )
    purchase_order = relationship("PurchaseOrder", back_populates="invoices", foreign_keys=[purchase_order_id])
    po_number = opt_str(100)

    # PROPOSAL |o--o{ INVOICE : "bills directly"
    proposal_id = Column(
        Integer, ForeignKey("proposals.id", ondelete="SET NULL"), nullable=True
    )
    proposal = relationship("Proposal", back_populates="direct_invoices", foreign_keys=[proposal_id])
    proposal_number = opt_str(100)

    client_name = Column(String(255), nullable=False, default="")
    address = opt_str(400)
    title = opt_str(100)
    business_name = opt_str()
    department = opt_str(100)
    phone = opt_str(50)
    email = opt_str()
    project_no = opt_str(100)
    agreement_no = opt_str(100)
    ship_date = Column(Date, nullable=True)
    payment_terms = opt_str(100)

    taxable = taxable()
    tax_rate = tax_rate()
    subtotal = money()
    sales_tax = money()
    total = money()
    payments_credits = money()
    line_items = line_items()
    notes = text()

    linked_client_po_id = Column(Integer, ForeignKey("purchase_orders.id", ondelete="SET NULL"), nullable=True)
    linked_owner_invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True)

    created_at = created_at()
    updated_at = updated_at()

    # CLIENT }o--o{ INVOICE : "receives"
    clients = relationship(
        "Client", secondary="client_invoices", back_populates="invoices"
    )

    # SUBCONTRACTOR }o--o{ INVOICE : "sends"
    subcontractors = relationship(
        "Subcontractor", secondary="subcontractor_invoices", back_populates="invoices"
    )

    # JOB }o--o{ INVOICE : "charges"
    jobs = relationship(
        "Job", secondary="job_invoices", back_populates="invoices"
    )
