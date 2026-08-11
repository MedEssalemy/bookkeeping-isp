from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.database import Base


class Proposal(Base):
    __tablename__ = "proposals"

    id = Column(Integer, primary_key=True, index=True)
    reference = Column(String(100), nullable=False, unique=True)
    status = Column(String(50), nullable=False, default="draft")

    # CLIENT }o--o{ PROPOSAL : "receives"
    clients = relationship(
        "Client", secondary="client_proposals", back_populates="proposals"
    )

    # SUBCONTRACTOR }o--o{ PROPOSAL : "sends"
    subcontractors = relationship(
        "Subcontractor", secondary="subcontractor_proposals", back_populates="proposals"
    )

    # PURCHASE_ORDER ||--o| PROPOSAL : "follows" (0 or 1 PO follows this proposal)
    purchase_order = relationship(
        "PurchaseOrder", back_populates="proposal", uselist=False
    )

    # PROPOSAL }o--o{ JOB : "covers"
    jobs = relationship(
        "Job", secondary="proposal_jobs", back_populates="proposals"
    )

    # Reference }o--o{ PROPOSAL (MP only)
    reference_docs = relationship(
        "ReferenceDoc", secondary="reference_proposals", back_populates="proposals"
    )
