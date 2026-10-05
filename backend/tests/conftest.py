"""
API tests run against a real PostgreSQL (JSONB, constraints), configured by
the usual POSTGRES_* env vars. Point them at a throwaway database — CI uses a
fresh service container; locally e.g.:

    docker compose exec db createdb -U app_user erd_test
    docker compose exec -e POSTGRES_DB=erd_test backend sh -c "pip install -q -r requirements-dev.txt && pytest"
"""
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

from app.database import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.models import User, UserRole  # noqa: E402
from app.security import hash_password  # noqa: E402

EMAIL, PASSWORD = "ci-admin@isp.com", "ci-password"


@pytest.fixture(scope="session", autouse=True)
def database():
    subprocess.run(["alembic", "upgrade", "head"], cwd=BACKEND, check=True)
    subprocess.run([sys.executable, "scripts/seed.py"], cwd=BACKEND, check=True)
    db = SessionLocal()
    try:
        if db.execute(select(User).where(User.email == EMAIL)).scalar_one_or_none() is None:
            db.add(User(email=EMAIL, full_name="CI Admin", hashed_password=hash_password(PASSWORD), role=UserRole.admin))
            db.commit()
    finally:
        db.close()


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        token = c.post("/api/v1/auth/login", json={"email": EMAIL, "password": PASSWORD}).json()["access_token"]
        c.headers["Authorization"] = f"Bearer {token}"
        c.base_url = str(c.base_url).rstrip("/") + "/api/v1"
        yield c
