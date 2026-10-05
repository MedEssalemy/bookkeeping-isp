# Bookkeeping ISP — Backend + Frontend Monorepo

Backend implementation of the ERD in `docs/erd_bidirectional.md`, built with
**FastAPI + SQLAlchemy + Alembic + PostgreSQL**, merged into one repo with the
**Vue 3 + Vite** frontend (originally `bookkeeping-isp`), all containerized
with Docker Compose.

```
project/
├── docs/
│   └── erd_bidirectional.md  # source-of-truth ERD this schema was built from
├── backend/                 # FastAPI service
│   ├── app/
│   │   ├── models/          # SQLAlchemy models + M:N junction tables
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   ├── crud/            # generic CRUD helpers
│   │   ├── routers/         # one router per entity + relationship endpoints
│   │   ├── config.py        # env-based settings
│   │   ├── database.py      # engine / session / Base
│   │   ├── security.py      # password hashing + JWT + auth dependencies
│   │   └── main.py          # FastAPI app entrypoint
│   ├── alembic/              # DB migrations
│   ├── scripts/create_user.py  # CLI for creating/updating user accounts
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/                 # Vue 3 + Vite app (bookkeeping-isp)
│   ├── src/
│   ├── vite.config.ts        # dev-server proxy: /api -> backend
│   ├── Dockerfile
│   └── .env.development / .env.production  # VITE_USE_MOCKS flag
├── docker-compose.yml         # postgres + backend + frontend, all networked together
└── .gitignore
```

## How the ERD maps to the schema

Source diagram: [`docs/erd_bidirectional.md`](docs/erd_bidirectional.md).

| ERD relationship | Implementation |
|---|---|
| `CLIENT }o--o{ PROPOSAL` (receives) | `client_proposals` junction table |
| `CLIENT ||--o{ PURCHASE_ORDER` (sends) | `purchase_orders.client_id` FK, nullable (set for received POs whose counterparty matches a client) |
| `CLIENT }o--o{ INVOICE` (receives) | `client_invoices` junction table |
| `SUBCONTRACTOR }o--o{ PROPOSAL` (sends) | `subcontractor_proposals` junction table |
| `SUBCONTRACTOR }o--o{ PURCHASE_ORDER` (receives) | `subcontractor_purchase_orders` junction table |
| `SUBCONTRACTOR }o--o{ INVOICE` (sends) | `subcontractor_invoices` junction table |
| `PURCHASE_ORDER ||--o| PROPOSAL` (follows) | `purchase_orders.proposal_id` FK, nullable |
| `PURCHASE_ORDER \|o--o{ INVOICE` (bills) | `invoices.purchase_order_id` FK, nullable — an invoice may bill a PO, or not |
| `PROPOSAL \|o--o{ INVOICE` (bills directly) | `invoices.proposal_id` FK, nullable — lets an invoice bill a proposal with no PO in between, or stand fully alone if both are null |
| `PURCHASE_ORDER }o--o{ JOB` (includes) | `purchase_order_jobs` junction table |
| `PROPOSAL }o--o{ JOB` (covers) | `proposal_jobs` junction table |
| `JOB }o--o{ SUBCONTRACTOR` (handles) | `job_subcontractors` junction table |
| `JOB }o--o{ INVOICE` (charges) | `job_invoices` junction table |
| `Reference }o--o{ PROPOSAL` | `reference_proposals` junction table. Entity renamed `ReferenceDoc` / table `reference_docs` because `REFERENCES` is a reserved PostgreSQL keyword. |

Every model + relationship was verified against a real local Postgres instance
(`alembic revision --autogenerate` correctly detected all tables; create,
link/unlink, and FK-constraint behavior were exercised via live HTTP requests).

### Client fields (flat contact model)

`clients` carries the frontend's full `ClientContact` field set directly on
one row — `name`, `address` (required), plus optional `title`,
`business_name`, `department`, `phone`, `email`, `city`, `county`, `state`,
`zip`, `address_full`, and `facility`.

This is a deliberate **flat** model: each row is one contact person, and
`business_name`/address fields are duplicated across every contact at the
same business rather than normalized into a separate `businesses` table.
That's simpler to build and query today, at the cost of having to update
shared info (like a business's address) on every one of its contacts
separately if it changes. If that duplication becomes painful once there's
real data, splitting into `businesses` + `contacts` tables is the natural
next step — but wasn't needed yet.

`subcontractors` mirrors this exactly, field-for-field (replacing the old
generic `contact` string) — the frontend's own `Contractor` type is
literally defined as `= ClientContact`, i.e. subcontractors and clients use
the identical contact shape on that side of the codebase.

## Authentication

The API requires a Bearer token on every route except `POST /api/v1/auth/login`.
This matches the frontend's `src/api/auth.ts` / `src/stores/auth.ts` contract exactly:

```
POST /api/v1/auth/login
  in:  { "email": "...", "password": "..." }
  out: { "access_token": "...", "user": { "id", "email", "full_name", "role" } }
```

`role` is one of `admin`, `editor`, `viewer`. Reads (`GET`) only require a valid
token; creates/updates/deletes additionally require `admin` or `editor`
(`viewer` gets a `403`) — enforced server-side, not just hidden in the UI.

There's no self-registration endpoint on purpose — accounts are created directly
via a CLI script (admin-managed):

```bash
# From backend/, with the venv active (or `docker compose exec backend ...`)
python scripts/create_user.py --email admin@isp.com --password admin123 \
  --full-name "Abe Ahalla" --role admin
```

The `admin@isp.com` / `admin123` example above intentionally matches the
frontend's temporary mock login (`stores/auth.ts`) — seed that user locally and
you can flip the frontend's commented-out real `login()` implementation on
without changing test credentials.

Set a real `jwt_secret_key` in `backend/.env` before deploying anywhere beyond
your own machine — the default in `config.py` is dev-only.

## Current state: what's real vs. mocked

The frontend runs against the real API and Postgres (`VITE_USE_MOCKS=false`):

- **Login is real**: `POST /api/v1/auth/login` issues a JWT; every other route
  requires it. Create users with `scripts/create_user.py` (see Authentication).
- **All screens read/write the database**: proposals, purchase orders and
  invoices (both directions), clients, contractors, config lists (job codes,
  payment terms, MP references, MP destinations), tax-rate lookup and
  attachments. The backend routes mirror the frontend's `src/api/*.ts` calls
  (`/proposals`, `/pos`, `/invoices`, `/clients/contacts/all`,
  `/contractors/all`, `/config-lists/{name}`, `/mp-destinations`,
  `/tax-rates/lookup`, `/{module}/{id}/attachments`, ...).
- **Seed data**: on boot, `scripts/seed.py` fills empty config lists, tax rates
  and the initial client contacts. It only touches empty tables, so it never
  overwrites your edits. Documents start empty.
- **Still placeholder**: `.docx` document generation (`/…/{id}/document`
  returns a text stub), and the Overview / P&L / Expenses / Bookkeeping /
  Taxes pages, which have no data wiring yet.

Documents store their full form shape (counterparty snapshot, totals, line
items as JSONB) on the ERD tables; the ERD links (`client_proposals`,
`subcontractor_invoices`, `purchase_orders.client_id`, ...) are filled
automatically by matching the counterparty name to a client/contractor row.

Set `VITE_USE_MOCKS=true` (in `docker-compose.yml` or `frontend/.env.development`)
to run the UI on in-memory mocks without the backend.

## Prerequisites

- Docker + Docker Compose (recommended path), **or**
- Python 3.12 and a local PostgreSQL 16 instance (manual path)

---

## Option A — Run everything with Docker (recommended)

All commands below are run from the **project root** (the folder containing `docker-compose.yml`).

```bash
# 1. Copy the env template and adjust credentials if you like
cp backend/.env.example backend/.env

# 2. Build and start Postgres + the API + the frontend (migrations run automatically on boot)
docker compose up --build

# Now available at:
#   http://localhost:5173        (the frontend app)
#   http://localhost:8000/docs   (interactive Swagger UI)
#   http://localhost:8000/health
```

Note: the frontend's `package.json` has a pre-existing dependency conflict
between Tiptap packages (unrelated to this merge) — the Dockerfile installs
with `--legacy-peer-deps` to work around it. If you ever run `npm install`
locally outside Docker, do the same: `npm install --legacy-peer-deps`.

To stop: `docker compose down` (add `-v` to also drop the Postgres volume).

## Option B — Run manually (no Docker)

```bash
# From: project/backend/
cp .env.example .env                 # edit if your local Postgres differs
python3 -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Make sure Postgres is running locally and the db/user in .env exist, e.g.:
#   createuser app_user --pwprompt
#   createdb erd_db -O app_user

# Apply migrations
alembic upgrade head

# Run the API with hot reload
uvicorn app.main:app --reload
```

## Everyday commands (from `project/backend/`)

| Task | Command |
|---|---|
| Create a new migration after changing models | `alembic revision --autogenerate -m "describe the change"` |
| Apply migrations | `alembic upgrade head` |
| Roll back one migration | `alembic downgrade -1` |
| Run the dev server | `uvicorn app.main:app --reload` |
| Run inside Docker instead | `docker compose exec backend alembic revision --autogenerate -m "..."` |

All API endpoints live under `/api/v1` — e.g. `POST /api/v1/clients/`,
`GET /api/v1/clients/{id}/proposals`, `POST /api/v1/clients/{id}/proposals/{proposal_id}`
to link a client and proposal. Full interactive docs at `/docs`.

---

## Git workflow, CI/CD and deployment

Two long-lived branches: **`dev`** (deployed to the Azure dev environment on
every merge) and **`prod`** (deployed + tagged `vX.Y.Z` when the auto-generated
release PR is merged). Full details and the one-time Azure/GitHub setup:
[`infra/azure/README.md`](infra/azure/README.md).

```bash
git checkout dev && git pull
git checkout -b feat/short-description
# ...changes...
git commit -m "feat: short description"
git push -u origin feat/short-description
# open a PR into dev with a Conventional Commit title (feat:/fix:/chore: ...),
# wait for CI, squash-merge -> dev deploys -> a "release: vX.Y.Z" PR to prod appears
```

Backend tests (run in CI against Postgres; locally against a throwaway DB):

```bash
docker compose exec db createdb -U app_user erd_test
docker compose exec -e POSTGRES_DB=erd_test backend sh -c "pip install -q -r requirements-dev.txt && pytest"
```

Notes:

- `backend/.env` is git-ignored (local DB credentials); only `.env.example` is committed.
  Deployed environments get their secrets from Azure Key Vault.
- Generated migration files under `backend/alembic/versions/` **must** be
  committed together with the model change — CI fails if models and
  migrations drift (`alembic check`).

---

## Design choices worth knowing about

- **Junction tables over association objects**: all `}o--o{` relations in the
  ERD are plain many-to-many link tables (no extra attributes on the
  relationship itself). If you later need attributes on a link (e.g. a
  quantity on `purchase_order_jobs`), convert that table to a proper model.
- **Generic CRUD + router factory** (`app/crud/base.py`, `app/routers/factory.py`):
  keeps each entity's router down to ~10 lines for the standard endpoints;
  relationship-specific endpoints are added on top per router.
- **`ReferenceDoc`** intentionally diverges in naming from the ERD's
  `Reference` label because `REFERENCES` is a reserved SQL keyword.
