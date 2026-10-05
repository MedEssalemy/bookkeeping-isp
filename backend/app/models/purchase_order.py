from sqlalchemy import Column, Integer, String, Date, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base
from app.models._doc_columns import (
    money, tax_rate, taxable, line_items, opt_str, text, created_at, updated_at,
)


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"
    __table_args__ = (UniqueConstraint("po_number", "direction", name="uq_purchase_orders_number_direction"),)

    id = Column(Integer, primary_key=True, index=True)
    po_number = Column(String(100), nullable=False)        # API field: number
    order_date = Column(Date, nullable=False)              # API field: date
    status = Column(String(50), nullable=False, default="Open")
    direction = Column(String(20), nullable=False, default="received")

    # CLIENT ||--o{ PURCHASE_ORDER : "sends" -> set for received (client) POs
    # when the counterparty matches a client row; issued POs go to subcontractors.
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="SET NULL"), nullable=True)
    client = relationship("Client", back_populates="purchase_orders")

    # PURCHASE_ORDER ||--o| PROPOSAL : "follows"
    proposal_id = Column(Integer, ForeignKey("proposals.id", ondelete="SET NULL"), nullable=True)
    proposal = relationship("Proposal", back_populates="purchase_order", foreign_keys=[proposal_id])
    proposal_number = opt_str(100)

    client_name = Column(String(255), nullable=False, default="")
    address = opt_str(400)
    project_no = opt_str(100)
    agreement_no = opt_str(100)
    ship_date = Column(Date, nullable=True)
    ship_to = opt_str(400)
    payment_terms = opt_str(100)

    taxable = taxable()
    tax_rate = tax_rate()
    subtotal = money()
    sales_tax = money()
    total = money()
    line_items = line_items()
    notes = text()

    linked_client_po_id = Column(Integer, ForeignKey("purchase_orders.id", ondelete="SET NULL"), nullable=True)
    linked_owner_invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="SET NULL", use_alter=True), nullable=True)

    created_at = created_at()
    updated_at = updated_at()

    # PURCHASE_ORDER |o--o{ INVOICE : "bills"
    invoices = relationship("Invoice", back_populates="purchase_order", foreign_keys="Invoice.purchase_order_id")

    # SUBCONTRACTOR }o--o{ PURCHASE_ORDER : "receives"
    subcontractors = relationship(
        "Subcontractor", secondary="subcontractor_purchase_orders", back_populates="purchase_orders"
    )

    # PURCHASE_ORDER }o--o{ JOB : "includes"
    jobs = relationship(
        "Job", secondary="purchase_order_jobs", back_populates="purchase_orders"
    )
