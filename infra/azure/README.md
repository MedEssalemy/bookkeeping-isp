# CI/CD and Azure deployment

Two long-lived branches, both deployed to Azure Container Apps. Each
environment runs **one container** (root `Dockerfile`): FastAPI serves the API
under `/api/v1` and the built Vue app on every other path, so there is one
URL, no proxy and no CORS. Local development is unchanged (`docker compose up`).

| Branch | Environment | Deployed when | Image tag |
|---|---|---|---|
| `dev`  | dev  | every merge into `dev` | `sha-<7 chars>` |
| `prod` | prod | merging the release PR | `vX.Y.Z` (also the git tag) |

## The flow

```
feature/x ──PR (CI)──▶ dev ──auto deploy──▶ Azure dev
                        │
                        └─ auto-opens/updates PR "release: vX.Y.Z"  dev ──▶ prod
                                                                     │ merge
                                                                     ▼
                                    Azure prod  ◀──auto deploy── prod ──▶ tag vX.Y.Z + GitHub Release
```

1. Branch off `dev`, commit, push, open a PR into `dev`.
2. **CI** (`.github/workflows/ci.yml`) runs: backend lint (ruff) and API
   tests on a real Postgres + migration check; frontend lint (ESLint), unit
   tests (Vitest), type-check + build; the Docker image build plus a
   vulnerability scan (Trivy: fails on fixable HIGH/CRITICAL findings); and a
   PR-title check.
3. **Squash-merge** the PR. **Deploy dev** (`deploy-dev.yml`) builds the
   image, pushes it to GHCR, deploys to Azure dev, smoke-tests it, then
   opens or updates the PR `dev → prod` titled `release: vX.Y.Z`.
   Merges that only touch `docs/` or `*.md` files skip this deploy.
4. When dev looks good, **merge the release PR (use "Create a merge commit")**.
   **Release prod** (`release-prod.yml`) **promotes the image dev already
   ran**: when prod's code is identical to the release PR's dev commit, its
   `sha-xxxxxxx` image is re-tagged `vX.Y.Z` (no rebuild), so prod runs the
   exact image you tested. Otherwise (a hotfix not yet merged back into dev,
   or a docs-only last merge) it builds from source. Then it deploys to Azure
   prod, smoke-tests, and creates the `vX.Y.Z` tag and GitHub Release. Move
   the `Unreleased` entries in `CHANGELOG.md` under the new version.

### Version numbers

Computed from [Conventional Commits](https://www.conventionalcommits.org/)
since the last tag (`.github/scripts/next-version.sh`). Because dev PRs are
squash-merged, **the PR title is the commit message** — CI enforces the format:

| PR title | Bump |
|---|---|
| `fix: …`, `chore: …`, `refactor: …`, `docs: …`, … | patch `v1.2.3 → v1.2.4` |
| `feat: …` / `feat(scope): …` | minor `v1.2.3 → v1.3.0` |
| `feat!: …` or a body line `BREAKING CHANGE: …` | major `v1.2.3 → v2.0.0` |

The first release starts from `v0.0.0`. To override, edit the release PR's
title before merging — the prod workflow uses the version in that title.

## Secrets

No passwords are stored in GitHub. Actions authenticates to Azure with
**OIDC**: each environment has its own Entra app, trusting only this repo's
`dev` or `prod` GitHub environment and allowed to deploy only that
environment's Container App. The app secrets (`pg-password`, plus
`jwt-secret-key-dev` and `jwt-secret-key-prod`, so a dev login token is never
valid on prod) are generated into the shared **Azure Key Vault** and
referenced by the Container Apps through their managed identity. The image is
copied from GHCR into the shared Azure Container Registry and pulled with the
same identity.

## Azure layout (shared by dev and prod)

One resource group, `rg-bookkeeping`, holds everything. Only the apps and the
databases exist once per environment:

| Resource | Shared or per environment |
|---|---|
| PostgreSQL Flexible Server `pg-bookkeeping-<suffix>` (B1ms) | **shared**, with one **database per environment**: `erd_db` (prod) and `erd_db_dev` (dev). Dev can't touch prod's tables, and dev can be reset by dropping its database. |
| Container registry `acrbookkeeping<suffix>` | shared (one image repo: dev's `sha-…` tags and prod's `vX.Y.Z` tags) |
| Key Vault `kv-bookkeeping-<suffix>` | shared (one JWT key per environment) |
| Managed identity `id-bookkeeping` | shared |
| Container Apps environment `cae-bookkeeping` | shared |
| Container App | per environment: `ca-bookkeeping-dev`, `ca-bookkeeping-prod` |
| Entra deploy app (GitHub OIDC) | per environment: `gh-bookkeeping-<env>-deploy`, scoped to its own app |

Rough cost: **≈ $21/month for both environments** (Postgres B1ms ≈ $16, ACR
Basic ≈ $5). The apps scale to zero when idle and stay within the Container
Apps free monthly grant; the first request after a quiet period takes a few
seconds (cold start).

## One-time setup

### 1. Azure (one run for both environments)

Needs the [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli),
an account that is **Owner** (or Contributor + User Access Administrator) on
the subscription, and permission to create Entra app registrations. Run from
Git Bash / WSL / Cloud Shell:

```bash
az login
az account set --subscription "<subscription id>"
MSYS_NO_PATHCONV=1 GITHUB_REPO=<owner>/<repo> ./infra/azure/setup.sh
```

- `GITHUB_REPO` must be the repo that deploys: Azure only trusts that repo.
- `MSYS_NO_PATHCONV=1` is needed on Git Bash only. It stops Git Bash rewriting Azure resource IDs as Windows paths.
- The script is idempotent: if it stops partway, fix the cause and run it again.
- The default region is West US 2 (`westus2`). On the reference subscription, East US refused new Postgres servers, and East US 2 refused the B1ms size (`SkuNotAvailable`). New subscriptions often get per-region limits like these; an Azure support request ("Service and subscription limits") can lift them. Override with e.g. `LOCATION=centralus`.
- A subscription allows only **2 Container Apps environments per region** by default. The shared layout needs one.

The run prints the GitHub variables for both environments at the end.

### 2. GitHub (repo admin)

1. **Environments** — Settings → Environments → create `dev` and `prod`.
   In each, add the **variables** printed by `setup.sh` (`AZURE_CLIENT_ID`,
   `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`,
   `AZURE_ACR_NAME`, `AZURE_APP`).
   On `prod`, optionally add *Required reviewers* for a manual approval gate.
   *Until these exist, the pipeline still builds and pushes images but skips
   the deploy with a warning.*
2. **Let Actions open PRs** — Settings → Actions → General → Workflow
   permissions → tick *Allow GitHub Actions to create and approve pull requests*.
3. **Default branch** — Settings → General → Default branch → `dev`.
4. **Merge buttons** — Settings → General → Pull Requests: keep both
   *Allow squash merging* and *Allow merge commits* enabled.
5. **Branch protection** — Settings → Branches (or Rules → Rulesets):
   - `dev`: require a pull request; require status checks *PR title
     (conventional)*, *Backend lint & tests*, *Frontend lint, tests & build*,
     *Docker image build & scan*; block force pushes.
   - `prod`: require a pull request; block force pushes. Don't require the CI
     checks here: the release PR is opened by `GITHUB_TOKEN`, and GitHub doesn't
     run workflows for PRs that token opens. (Everything in it already passed
     CI on the way into `dev`.) To run CI on release PRs too, add a
     fine-grained PAT (contents + pull requests: write) as the repo secret
     `RELEASE_PR_TOKEN`. The workflow uses it when it's set.
6. **Image** — after the first run, the package `bookkeeping-project`
   appears under the repo's Packages; it can stay private (Azure imports it
   with the workflow token).
7. **Dependabot** — `.github/dependabot.yml` opens weekly update PRs into
   `dev` (GitHub Actions, pip, npm, Docker base images), titled
   `chore(deps): …` so they pass the PR-title check. Enable *Dependabot alerts*
   and *security updates* under Settings → Code security.

### 3. First login on each environment

There's no sign-up page. After the first successful deploy, open a shell in
the app: Azure Portal → Container Apps → `ca-bookkeeping-dev` (or `-prod`) →
Monitoring → Console → `/bin/sh`. Or, from **PowerShell**,
`az containerapp exec -g rg-bookkeeping -n ca-bookkeeping-dev`. Then run:

```sh
python scripts/create_user.py --email you@company.com --password '<strong>' --full-name 'Your Name' --role admin
```

The same command with an existing email resets that user's password.

## Operations

- **Rollback**: re-run an older *Release prod* / *Deploy dev* run, or
  `az containerapp update -g <rg> -n <app> --image <acr>.azurecr.io/bookkeeping:<older tag>`.
  Database migrations are forward-only: check `alembic downgrade` before
  rolling back across a schema change.
- **Logs**: `az containerapp logs show -g <rg> -n <app> --follow`. Each start
  logs the version and which settings are set (never their values), so a
  missing Key Vault reference shows up there first.
- **Health**: `GET /health` returns `{"status": "ok", "version": "…"}`. The
  Container App's startup, liveness and readiness probes use it (set by
  `setup.sh`); the version also appears in the app's profile menu.
- **Hotfix**: branch from `prod`, PR into `prod`. The push is released with
  a computed version. Then merge `prod` back into `dev`.
- **Rotate a secret**: set a new version in Key Vault, then restart the
  revision. Containers pick up new Key Vault versions within ~30 minutes, or
  right away after a restart. Changing `pg-password` also requires
  `az postgres flexible-server update --admin-password`.
