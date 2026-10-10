from sqlalchemy import Column, Integer, String, Numeric, UniqueConstraint
from app.database import Base


class TaxRate(Base):
    __tablename__ = "tax_rates"
    __table_args__ = (UniqueConstraint("city", "state", name="uq_tax_rates_city_state"),)

    id = Column(Integer, primary_key=True, index=True)
    city = Column(String(100), nullable=False)
    state = Column(String(50), nullable=False)
    rate = Column(Numeric(8, 5), nullable=False)
