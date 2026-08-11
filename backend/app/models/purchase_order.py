from sqlalchemy import Column, Integer, String, Date, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True, index=True)
    po_number = Column(String(100), nullable=False, unique=True)
    order_date = Column(Date, nullable=False)
    status = Column(String(50), nullable=False, default="open")

    # CLIENT ||--o{ PURCHASE_ORDER : "sends" -> every PO belongs to exactly one client
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False)
    client = relationship("Client", back_populates="purchase_orders")

    # PURCHASE_ORDER ||--o| PROPOSAL : "follows" -> a PO follows at most one proposal
    proposal_id = Column(
        Integer, ForeignKey("proposals.id", ondelete="SET NULL"), nullable=True, unique=True
    )
    proposal = relationship("Proposal", back_populates="purchase_order")

    # PURCHASE_ORDER ||--|{ INVOICE : "bills" -> one PO has one or more invoices
    invoices = relationship("Invoice", back_populates="purchase_order")

    # SUBCONTRACTOR }o--o{ PURCHASE_ORDER : "receives"
    subcontractors = relationship(
        "Subcontractor", secondary="subcontractor_purchase_orders", back_populates="purchase_orders"
    )

    # PURCHASE_ORDER }o--o{ JOB : "includes"
    jobs = relationship(
        "Job", secondary="purchase_order_jobs", back_populates="purchase_orders"
    )
