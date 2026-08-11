from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.database import Base


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, unique=True, index=True)

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
