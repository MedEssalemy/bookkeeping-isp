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
| `CLIENT ||--o{ PURCHASE_ORDER` (sends) | `purchase_orders.client_id` FK, NOT NULL |
| `CLIENT }o--o{ INVOICE` (receives) | `client_invoices` junction table |
| `SUBCONTRACTOR }o--o{ PROPOSAL` (sends) | `subcontractor_proposals` junction table |
| `SUBCONTRACTOR }o--o{ PURCHASE_ORDER` (receives) | `subcontractor_purchase_orders` junction table |
| `SUBCONTRACTOR }o--o{ INVOICE` (sends) | `subcontractor_invoices` junction table |
| `PURCHASE_ORDER ||--o| PROPOSAL` (follows) | `purchase_orders.proposal_id` FK, nullable + unique |
| `PURCHASE_ORDER \|o--o{ INVOICE` (bills) | `invoices.purchase_order_id` FK, nullable — an invoice may bill a PO, or not |
| `PROPOSAL \|o--o{ INVOICE` (bills directly) | `invoices.proposal_id` FK, nullable — lets an invoice bill a proposal with no PO in between, or stand fully alone if both are null |
| `PURCHASE_ORDER }o--o{ JOB` (includes) | `purchase_order_jobs` junction table |
| `PROPOSAL }o--o{ JOB` (covers) | `proposal_jobs` junction table |
| `JOB }o--o{ SUBCONTRACTOR` (handles) | `job_subcontractors` junction table |
| `JOB }o--o{ INVOICE` (charges) | `job_invoices` junction table |
| `Reference }o--o{ PROPOSAL` | `reference_proposals` junction table. Entity renamed `ReferenceDoc` / table `reference_docs` because `REFERENCES` is a reserved PostgreSQL keyword. |

Every model + relationship was verified against a real local Postgres instance
(`alembic revision --autogenerate` correctly detected all 18 tables; create,
link/unlink, and FK-constraint behavior were exercised via live HTTP requests).

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

Merging the two repos wires them together and proves the connection works —
it does **not** mean every screen is live yet. Be precise about this when
testing:

- **Login is real and tested end-to-end**: frontend (port 5173) → Vite proxy
  → backend (port 8000) → Postgres → JWT back. To actually use it, uncomment
  the real `login()` in `frontend/src/stores/auth.ts` (marked
  `UNCOMMENT WHEN API IS READY`) and comment out the temp mock one above it.
- **Everything else still runs on mocks** (`VITE_USE_MOCKS=true` by default).
  The frontend's resource files (`src/api/clients.ts`, `invoices.ts`, etc.)
  already branch on this flag and call real endpoints like `/clients/lookup`,
  `/contractors/names`, `/pos/next-number` — but the backend doesn't expose
  those routes yet. It currently exposes a simpler generic CRUD API
  (`/clients/`, `/clients/{id}`, etc. — see the ERD mapping table above).
- **Don't flip `VITE_USE_MOCKS` to `false`** until those endpoint contracts
  are aligned — most screens would 404 immediately.

Aligning the backend's routes to match what the frontend already expects
is the natural next piece of work.

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

## Git usage

Run these from the **project root** (`project/`).

### First-time setup

```bash
git init
git add .
git commit -m "Initial backend scaffold: FastAPI + SQLAlchemy + Alembic + Postgres"
```

Then connect it to a remote (GitHub/GitLab/etc.) and push:

```bash
git remote add origin <your-repo-url>
git branch -M main
git push -u origin main
```

### Day-to-day workflow

```bash
git checkout -b feature/short-description   # branch per feature/fix
# ...make changes in backend/...
git add .
git status                                  # sanity-check what's staged
git commit -m "Add X"
git push -u origin feature/short-description
# open a PR, merge into main
```

### Notes

- `backend/.env` is git-ignored on purpose (it holds local DB credentials) —
  only `.env.example` is committed. Anyone cloning the repo copies it themselves.
- `frontend/` is currently an empty placeholder tracked with a `.gitkeep`,
  wired into `docker-compose.yml` (commented out) so the next iteration just
  has to add a `frontend/Dockerfile`, uncomment the service, and populate the folder.
- Generated migration files under `backend/alembic/versions/` **should** be
  committed — they're the source of truth for schema history, not local artifacts.
- If you rename/change models, always commit the model change and its
  corresponding Alembic migration file in the same commit.

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
