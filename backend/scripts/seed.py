"""
Seed reference data the app needs to be usable: config lists (job codes,
payment terms, MP references, MP destinations), tax rates, and the initial
client contacts. Idempotent — each section only runs when its table/list is
empty, so it's safe to run on every boot.

    python scripts/seed.py            (or: docker compose exec backend python scripts/seed.py)
"""
import json
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select, func
from app.database import SessionLocal
from app.models import ConfigListItem, TaxRate, Client
from app.services.parties import ContactInput, normalize

JOB_CODES = [
    "Decommissioning", "Medical Physics Services", "Service", "Rental", "Sales",
    "Equipment Move", "Parts", "Shipping", "System", "Transportation", "Discount",
    "Service Charge", "TAX Voucher Payment", "Insurance", "TAX Payment", "Relocate",
    "Sales and Use Tax", "Travel", "Property Tax", "Tax",
]

PAYMENT_TERMS = [
    ("Due On Receipt", 0), ("Net 15", 15), ("Net 30", 30), ("Net 45", 45), ("Net 60", 60),
]

REFERENCES = [
    "Proposal for Medical Physicist Professional Services",
    "Proposal for Medical Physicist",
]

MP_DESTINATIONS = [
    ("Memorial Hermann Hospital", "6411 Fannin St, Houston, TX 77030", "Houston", "TX"),
    ("MD Anderson Cancer Center", "1515 Holcombe Blvd, Houston, TX 77030", "Houston", "TX"),
    ("UT Southwestern Medical Center", "5323 Harry Hines Blvd, Dallas, TX 75390", "Dallas", "TX"),
    ("Baylor Scott & White Medical Center", "2401 S 31st St, Temple, TX 76508", "Temple", "TX"),
    ("Texas Children's Hospital", "6621 Fannin St, Houston, TX 77030", "Houston", "TX"),
]

TAX_RATES = [
    ("Austin", "TX", 0.0825), ("Houston", "TX", 0.0825), ("Dallas", "TX", 0.0825),
    ("San Antonio", "TX", 0.0825), ("Plano", "TX", 0.0825), ("Fort Worth", "TX", 0.0825),
    ("El Paso", "TX", 0.0825),
]


def _list_empty(db, name: str) -> bool:
    return db.execute(
        select(func.count()).select_from(ConfigListItem).where(ConfigListItem.list_name == name)
    ).scalar_one() == 0


def _table_empty(db, model) -> bool:
    return db.execute(select(func.count()).select_from(model)).scalar_one() == 0


def main():
    db = SessionLocal()
    seeded = []
    try:
        if _list_empty(db, "job_codes"):
            db.add_all(ConfigListItem(list_name="job_codes", label=label, sort_order=i) for i, label in enumerate(JOB_CODES))
            seeded.append("job_codes")
        if _list_empty(db, "payment_terms"):
            db.add_all(
                ConfigListItem(list_name="payment_terms", label=label, delay_days=d, sort_order=i)
                for i, (label, d) in enumerate(PAYMENT_TERMS)
            )
            seeded.append("payment_terms")
        if _list_empty(db, "references"):
            db.add_all(ConfigListItem(list_name="references", label=label, sort_order=i) for i, label in enumerate(REFERENCES))
            seeded.append("references")
        if _list_empty(db, "mp_destinations"):
            db.add_all(
                ConfigListItem(list_name="mp_destinations", label=label, physical_address=a, city=c, state=s, sort_order=i)
                for i, (label, a, c, s) in enumerate(MP_DESTINATIONS)
            )
            seeded.append("mp_destinations")
        if _table_empty(db, TaxRate):
            db.add_all(TaxRate(city=c, state=s, rate=r) for c, s, r in TAX_RATES)
            seeded.append("tax_rates")
        if _table_empty(db, Client):
            rows = json.loads((Path(__file__).parent / "seed_data" / "clients.json").read_text(encoding="utf-8"))
            db.add_all(Client(**normalize(ContactInput(**r))) for r in rows)
            seeded.append(f"clients ({len(rows)})")
        db.commit()
        print("Seeded: " + (", ".join(seeded) if seeded else "nothing (already populated)"))
    finally:
        db.close()


if __name__ == "__main__":
    main()
