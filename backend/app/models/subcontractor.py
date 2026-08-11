from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.database import Base


class Subcontractor(Base):
    __tablename__ = "subcontractors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    contact = Column(String(255), nullable=True)

    # SUBCONTRACTOR }o--o{ PROPOSAL : "sends"
    proposals = relationship(
        "Proposal", secondary="subcontractor_proposals", back_populates="subcontractors"
    )

    # SUBCONTRACTOR }o--o{ PURCHASE_ORDER : "receives"
    purchase_orders = relationship(
        "PurchaseOrder", secondary="subcontractor_purchase_orders", back_populates="subcontractors"
    )

    # SUBCONTRACTOR }o--o{ INVOICE : "sends"
    invoices = relationship(
        "Invoice", secondary="subcontractor_invoices", back_populates="subcontractors"
    )

    # JOB }o--o{ SUBCONTRACTOR : "handles"
    jobs = relationship(
        "Job", secondary="job_subcontractors", back_populates="subcontractors"
    )
