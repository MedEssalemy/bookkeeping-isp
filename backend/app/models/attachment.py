from sqlalchemy import Column, Integer, String, LargeBinary, DateTime, func
from app.database import Base


class Attachment(Base):
    """Counterparty's original file on a received proposal / PO / invoice."""
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    module = Column(String(20), nullable=False)        # proposals | pos | invoices
    record_id = Column(Integer, nullable=False, index=True)
    file_name = Column(String(255), nullable=False)
    mime_type = Column(String(255), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    data = Column(LargeBinary, nullable=False)
    uploaded_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
