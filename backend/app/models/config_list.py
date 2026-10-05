from sqlalchemy import Column, Integer, String, Boolean, UniqueConstraint
from app.database import Base


class ConfigListItem(Base):
    """
    Admin-managed dropdown values (job_codes, payment_terms, references,
    mp_destinations). One table for all lists; the list-specific extras are
    nullable columns. Documents store labels, so deactivating/deleting a value
    never corrupts saved documents.
    """
    __tablename__ = "config_list_items"
    __table_args__ = (UniqueConstraint("list_name", "label", name="uq_config_list_items_list_label"),)

    id = Column(Integer, primary_key=True, index=True)
    list_name = Column(String(50), nullable=False, index=True)
    label = Column(String(255), nullable=False)
    active = Column(Boolean, nullable=False, default=True, server_default="true")
    sort_order = Column(Integer, nullable=False, default=0, server_default="0")
    # payment_terms
    delay_days = Column(Integer, nullable=True)
    # mp_destinations
    physical_address = Column(String(400), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(50), nullable=True)
