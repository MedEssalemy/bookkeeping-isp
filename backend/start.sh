#!/bin/sh
# Container entrypoint for deployed environments: migrate, seed empty
# reference tables, then serve. (docker-compose overrides this with --reload.)
set -e

echo "=== Bookkeeping API ${APP_VERSION:-dev} ==="
# Which settings arrived — never their values. A missing Key Vault reference
# shows up here instead of as a confusing connection error further down.
for var in POSTGRES_HOST POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD POSTGRES_SSLMODE JWT_SECRET_KEY STATIC_DIR; do
  if [ -n "$(printenv "$var")" ]; then
    echo "  $var: set"
  else
    echo "  $var: (not set)"
  fi
done

alembic upgrade head
python scripts/seed.py
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips "*"
