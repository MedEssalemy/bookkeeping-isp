"""Tax rates — matches frontend/src/api/taxRates.ts."""
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import TaxRate
from app.security import get_current_user

router = APIRouter(prefix="/tax-rates", tags=["tax-rates"])


def serialize(r: TaxRate) -> dict:
    return {"id": str(r.id), "city": r.city, "state": r.state, "rate": float(r.rate)}


@router.get("")
def list_tax_rates(db: Session = Depends(get_db), _user=Depends(get_current_user)):
    rows = db.execute(select(TaxRate).order_by(TaxRate.state, TaxRate.city)).scalars()
    return [serialize(r) for r in rows]


@router.get("/lookup")
def lookup(city: str, state: str, db: Session = Depends(get_db), _user=Depends(get_current_user)):
    """Rate for a city/state, or 0 when unknown."""
    row = db.execute(
        select(TaxRate).where(
            func.lower(TaxRate.city) == city.strip().lower(),
            func.lower(TaxRate.state) == state.strip().lower(),
        )
    ).scalar_one_or_none()
    return {"rate": float(row.rate) if row else 0}
