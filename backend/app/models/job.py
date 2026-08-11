from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.database import Base


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(String, nullable=True)

    # PURCHASE_ORDER }o--o{ JOB : "includes"
    purchase_orders = relationship(
        "PurchaseOrder", secondary="purchase_order_jobs", back_populates="jobs"
    )

    # PROPOSAL }o--o{ JOB : "covers"
    proposals = relationship(
        "Proposal", secondary="proposal_jobs", back_populates="jobs"
    )

    # JOB }o--o{ SUBCONTRACTOR : "handles"
    subcontractors = relationship(
        "Subcontractor", secondary="job_subcontractors", back_populates="jobs"
    )

    # JOB }o--o{ INVOICE : "charges"
    invoices = relationship(
        "Invoice", secondary="job_invoices", back_populates="jobs"
    )
