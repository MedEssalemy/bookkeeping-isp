from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.database import Base


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    # Matches frontend/src/types/proposal.ts's ClientContact shape (flat model:
    # each row is one contact person; business_name/address are duplicated per
    # contact rather than normalized into a separate businesses table).
    address = Column(String(255), nullable=False, default="")
    title = Column(String(100), nullable=True)
    business_name = Column(String(255), nullable=True, index=True)
    department = Column(String(100), nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True, unique=True, index=True)
    city = Column(String(100), nullable=True)
    county = Column(String(100), nullable=True)
    state = Column(String(50), nullable=True)
    zip = Column(String(15), nullable=True)
    # Joined display string ("Street, City, ST Zip") — stored rather than
    # computed so CSV import/export round-trips are stable, same rationale
    # as the frontend's own comment on this field.
    address_full = Column(String(400), nullable=True)
    # Disambiguates multiple sites for the same business (e.g. "Elk Grove MOB").
    facility = Column(String(255), nullable=True)

    # CLIENT ||--o{ PURCHASE_ORDER : "sends"  (one client -> many POs)
    purchase_orders = relationship("PurchaseOrder", back_populates="client")

    # CLIENT }o--o{ PROPOSAL : "receives"
    proposals = relationship(
        "Proposal", secondary="client_proposals", back_populates="clients"
    )

    # CLIENT }o--o{ INVOICE : "receives"
    invoices = relationship(
        "Invoice", secondary="client_invoices", back_populates="clients"
    )
