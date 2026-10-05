#!/bin/sh
# Container entrypoint for deployed environments: migrate, seed empty
# reference tables, then serve. (docker-compose overrides this with --reload.)
set -e
alembic upgrade head
python scripts/seed.py
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips "*"
