from sqlalchemy import Column, Integer, String, Date, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(100), nullable=False, unique=True)
    invoice_date = Column(Date, nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)

    # PURCHASE_ORDER |o--o{ INVOICE : "bills" -> an invoice MAY bill a PO,
    # but doesn't have to (it can stand alone or bill a proposal directly instead).
    purchase_order_id = Column(
        Integer, ForeignKey("purchase_orders.id", ondelete="SET NULL"), nullable=True
    )
    purchase_order = relationship("PurchaseOrder", back_populates="invoices")

    # PROPOSAL |o--o{ INVOICE : "bills directly" -> used when an invoice is
    # raised straight off a proposal, with no PO in between.
    proposal_id = Column(
        Integer, ForeignKey("proposals.id", ondelete="SET NULL"), nullable=True
    )
    proposal = relationship("Proposal", back_populates="direct_invoices")

    # CLIENT }o--o{ INVOICE : "receives"
    clients = relationship(
        "Client", secondary="client_invoices", back_populates="invoices"
    )

    # SUBCONTRACTOR }o--o{ INVOICE : "sends"
    subcontractors = relationship(
        "Subcontractor", secondary="subcontractor_invoices", back_populates="invoices"
    )

    # JOB }o--o{ INVOICE : "charges" (direct relation, used when there is no PO)
    jobs = relationship(
        "Job", secondary="job_invoices", back_populates="invoices"
    )
