"""
Create (or update the password/role of) a user directly in the DB.
There's no self-registration endpoint on purpose — user accounts are
admin-managed. Run from backend/ with the venv active, or via:
    docker compose exec backend python scripts/create_user.py ...

Usage:
    python scripts/create_user.py --email admin@isp.com --password admin123 \
        --full-name "Abe Ahalla" --role admin
"""
import argparse
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select
from app.database import SessionLocal
from app.models.user import User, UserRole
from app.security import hash_password


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--full-name", required=True)
    parser.add_argument("--role", choices=[r.value for r in UserRole], default="viewer")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        existing = db.execute(select(User).where(User.email == args.email)).scalar_one_or_none()
        if existing:
            existing.hashed_password = hash_password(args.password)
            existing.full_name = args.full_name
            existing.role = UserRole(args.role)
            db.commit()
            print(f"Updated existing user: {existing.email} ({existing.role.value})")
        else:
            user = User(
                email=args.email,
                full_name=args.full_name,
                hashed_password=hash_password(args.password),
                role=UserRole(args.role),
            )
            db.add(user)
            db.commit()
            print(f"Created user: {user.email} ({user.role.value})")
    finally:
        db.close()


if __name__ == "__main__":
    main()
