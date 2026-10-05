# CI/CD and Azure deployment

Two long-lived branches, both deployed to Azure Container Apps:

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
2. **CI** (`.github/workflows/ci.yml`) runs: backend API tests on a real
   Postgres + migration check, frontend type-check + build, Docker image
   builds, and a PR-title check.
3. **Squash-merge** the PR. **Deploy dev** (`deploy-dev.yml`) builds the
   images, pushes them to GHCR, deploys to Azure dev, smoke-tests it, then
   opens or updates the PR `dev → prod` titled `release: vX.Y.Z`.
4. When dev looks good, **merge the release PR (use "Create a merge commit")**.
   **Release prod** (`release-prod.yml`) builds `vX.Y.Z` images, deploys to
   Azure prod, smoke-tests, then creates the `vX.Y.Z` tag and GitHub Release.

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
**OIDC** (a federated credential trusting only this repo's `dev`/`prod`
environments). The app secrets — `pg-password` and `jwt-secret-key` — are
generated into each environment's **Azure Key Vault** and referenced by the
backend Container App through its managed identity. Images are copied from
GHCR into each environment's Azure Container Registry, pulled with the same
identity.

## One-time setup

### 1. Azure (per environment)

Needs the [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli),
an account that is **Owner** (or Contributor + User Access Administrator) on
the subscription, and permission to create Entra app registrations. Run from
Git Bash / WSL / Cloud Shell:

```bash
az login
az account set --subscription "<subscription id>"
./infra/azure/setup.sh dev
./infra/azure/setup.sh prod
```

Optional: `LOCATION=francecentral PREFIX=bookkeeping ./infra/azure/setup.sh dev`.
Each run prints the GitHub variables for that environment. Rough cost per
environment: Postgres B1ms ≈ $15/mo, ACR Basic ≈ $5/mo, Container Apps mostly
within the free grant at this size.

### 2. GitHub (repo admin)

1. **Environments** — Settings → Environments → create `dev` and `prod`.
   In each, add the **variables** printed by `setup.sh` (`AZURE_CLIENT_ID`,
   `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`,
   `AZURE_ACR_NAME`, `AZURE_BACKEND_APP`, `AZURE_FRONTEND_APP`).
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
     (conventional)*, *Backend tests*, *Frontend type-check & build*,
     *Docker images build*; block force pushes.
   - `prod`: require a pull request; block force pushes. Don't require the CI
     checks here: the release PR is opened by `GITHUB_TOKEN`, and GitHub doesn't
     run workflows for PRs that token opens. (Everything in it already passed
     CI on the way into `dev`.) To run CI on release PRs too, add a
     fine-grained PAT (contents + pull requests: write) as the repo secret
     `RELEASE_PR_TOKEN`. The workflow uses it when it's set.
6. **Images** — after the first run, the packages
   `bookkeeping-project-backend` / `-frontend` appear under the repo's
   Packages; they can stay private (Azure imports them with the workflow token).

### 3. First login on each environment

After the first successful deploy, create an admin user (the command is also
printed by `setup.sh`):

```bash
az containerapp exec -g rg-bookkeeping-dev -n ca-bookkeeping-dev-api --command \
  "python scripts/create_user.py --email you@company.com --password '<strong>' --full-name 'Your Name' --role admin"
```

## Operations

- **Rollback**: re-run an older *Release prod* / *Deploy dev* run, or
  `az containerapp update -g <rg> -n <app> --image <acr>.azurecr.io/bookkeeping-backend:<older tag>`.
  Database migrations are forward-only: check `alembic downgrade` before
  rolling back across a schema change.
- **Logs**: `az containerapp logs show -g <rg> -n <app> --follow`.
- **Hotfix**: branch from `prod`, PR into `prod`. The push is released with
  a computed version. Then merge `prod` back into `dev`.
- **Rotate a secret**: set a new version in Key Vault, then restart the
  revision. Containers pick up new Key Vault versions within ~30 minutes, or
  right away after a restart. Changing `pg-password` also requires
  `az postgres flexible-server update --admin-password`.
