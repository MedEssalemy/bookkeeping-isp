from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.database import Base


class ReferenceDoc(Base):
    """
    Maps to the ERD's `Reference` entity.
    Renamed table to `reference_docs` because REFERENCES is a reserved
    SQL keyword in PostgreSQL and best avoided as an identifier.
    """
    __tablename__ = "reference_docs"

    id = Column(Integer, primary_key=True, index=True)
    value = Column(String(255), nullable=False)

    # Reference }o--o{ PROPOSAL (MP only)
    proposals = relationship(
        "Proposal", secondary="reference_proposals", back_populates="reference_docs"
    )
