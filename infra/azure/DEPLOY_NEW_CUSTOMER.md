# Deploying the bookkeeping app for a new customer

A step-by-step runbook for setting up the app in a **customer's own Azure
subscription and GitHub account**, with the same configuration as the
reference deployment (`MedEssalemy/bookkeeping-isp`, Azure West US 2).

At the end the customer has:

- **Two environments in Azure:** `dev` for testing and `prod` for daily use. They share one Postgres server, container registry, Key Vault and Container Apps environment. Each has its own app and its own database (`erd_db_dev` / `erd_db`), so no resource is paid for twice.
- **A GitHub repo** where merging into `dev` deploys to dev, and merging the release PR into `prod` deploys to prod and tags `vX.Y.Z`.
- **No passwords stored in GitHub.** GitHub logs in to Azure with OIDC, and the app's secrets live in Key Vault.

Plan for about 2 hours. Most of that is waiting for Azure, mainly Postgres.

> **Before you start:** your own repo's `dev` branch must include these fixes,
> which were found during the first deployment:
> - PR #22 (Node 24)
> - PR #23 (`setup.sh` fixes for new subscriptions and Azure CLI 2.91)
> - PR #24 (smoke-test email)
>
> This runbook assumes they're merged.

---

## Contents

1. [What the customer must provide](#1-what-the-customer-must-provide)
2. [Tools on your PC](#2-tools-on-your-pc)
3. [Create the customer's repo and push the code](#3-create-the-customers-repo-and-push-the-code)
4. [Provision Azure (dev, then prod)](#4-provision-azure-dev-then-prod)
5. [Configure the GitHub repo](#5-configure-the-github-repo)
6. [First deploy and verification](#6-first-deploy-and-verification)
7. [Create the first logins](#7-create-the-first-logins)
8. [Day-to-day workflow (hand this to the customer)](#8-day-to-day-workflow)
9. [Costs and budget alert](#9-costs-and-budget-alert)
10. [Troubleshooting (every error we actually hit)](#10-troubleshooting)
11. [Handover checklist](#11-handover-checklist)

Throughout, replace these placeholders:

| Placeholder | Example | Meaning |
|---|---|---|
| `<CUSTOMER_GH>` | `acme-bookkeeping` | Customer's GitHub user or organization |
| `<REPO>` | `bookkeeping` | Repo name in the customer's account |
| `<SUB_ID>` | `5c068809-…` | Customer's Azure subscription ID |
| `<TENANT_ID>` | `d29d7d98-…` | Customer's Microsoft Entra (Azure AD) tenant ID |
| `<REGION>` | `westus2` | Azure region (see [4.2](#42-pick-a-region-that-accepts-postgres)) |

---

## 1. What the customer must provide

### Azure

1. **An Azure subscription.** Pay-as-you-go is fine; it's what the reference deployment uses.
2. **An account for you in their tenant.** The most reliable option is a *member* account, e.g. `mohamed@customer.com`. A guest invite of your own email also works, but guests often can't create app registrations, which step 4 needs.
3. **Owner role on the subscription** for that account. Owner is needed because the script assigns roles (Key Vault, AcrPull, GitHub deploy identity); Contributor alone can't.
   - Azure Portal → **Subscriptions** → the subscription → **Access control (IAM)** → **Add role assignment** → **Owner** → your account.
4. **Permission to create app registrations** in Microsoft Entra ID.
   - Members can by default.
   - If the tenant restricts it, or you're a guest, the customer assigns you the **Application Developer** role under Entra ID → **Roles and administrators**.

### GitHub

1. **A GitHub account or organization.** An organization is better for a business: the customer owns it and can add or remove people.
2. **A paid plan if the repo is private** (it should be, since it's the customer's code):
   - **GitHub Pro** for a personal account, or **GitHub Team** for an organization, about $4 per user per month (check current pricing).
   - On the free plan, a **private** repo can't use **environments** (which the pipeline depends on) or **branch protection**.
3. **Admin access to the repo for your GitHub account:** repo → Settings → Collaborators (or org → Teams) → role **Admin**.

> Write down the customer's **subscription ID** and **tenant ID**. Azure
> Portal → Subscriptions shows both, or run `az account show` after you log in.

---

## 2. Tools on your PC

Install these once:

| Tool | Install (PowerShell) | Check |
|---|---|---|
| Git + Git Bash | `winget install -e --id Git.Git` | `git --version` |
| Azure CLI | `winget install -e --id Microsoft.AzureCLI` | `az version` |
| GitHub CLI | `winget install -e --id GitHub.cli` | `gh --version` |

After installing, **close and reopen your terminals**. A terminal that was already open won't see the new commands.

Run the bash snippets below in **Git Bash**. Two Windows gotchas:

- **Always set `MSYS_NO_PATHCONV=1` for Azure commands in Git Bash.** Otherwise Git Bash rewrites Azure resource IDs such as `/subscriptions/...` into Windows paths, and role assignments fail. Easiest: run `export MSYS_NO_PATHCONV=1` once per Git Bash window.
- **Use PowerShell (not Git Bash) for `az containerapp exec`**, which needs a real interactive terminal (see step 7).

If `az` isn't found in Git Bash right after installing:
```bash
export PATH="/c/Program Files/Microsoft SDKs/Azure/CLI2/wbin:$PATH"
```

---

## 3. Create the customer's repo and push the code

### 3.1 Log in to GitHub as yourself

You must have admin rights on the customer's repo.

```bash
gh auth login        # choose GitHub.com, HTTPS, log in with a web browser
gh auth status
```

### 3.2 Create the repo

Skip this if the customer already created it.

```bash
gh repo create <CUSTOMER_GH>/<REPO> --private --description "Bookkeeping app"
```

### 3.3 Push the code: don't push yet

Pushing the `dev` and `prod` branches **starts the deploy workflows straight away**. So push only after Azure is provisioned (step 4) and the GitHub variables are set (step 5). Pushing comes in [step 6](#6-first-deploy-and-verification).

For now, just add the customer's repo as a remote in your local clone:

```bash
cd "/e/Bookkeeping Project/bookkeeping-project"
git fetch isp                      # your own repo, kept up to date
git remote add customer https://github.com/<CUSTOMER_GH>/<REPO>.git
```

---

## 4. Provision Azure (dev, then prod)

### 4.1 Log in to the customer's tenant

```bash
export MSYS_NO_PATHCONV=1
az login --tenant <TENANT_ID>
az account set --subscription <SUB_ID>
az account show --query "{subscription:name, id:id, user:user.name}" -o table

# You must be Owner:
az role assignment list --assignee "$(az ad signed-in-user show --query id -o tsv)" \
  --scope /subscriptions/<SUB_ID> --include-inherited --query "[].roleDefinitionName" -o tsv
```

### 4.2 Pick a region that accepts Postgres

**New subscriptions often can't create Postgres in popular regions.** On the
reference subscription:

- **East US** refused new Postgres servers ("location is restricted").
- **East US 2** refused the `Standard_B1ms` size (`SkuNotAvailable`) in every zone.
- **West US 2** worked.

The quickest reliable test is to create a throwaway server, then delete it.
It costs a few cents. Try the regions nearest the customer first:

```bash
export MSYS_NO_PATHCONV=1
az provider register --namespace Microsoft.DBforPostgreSQL --wait
az group create -n rg-pgprobe -l westus2 -o none
PW="Pr0be-$(openssl rand -hex 12)"; N="pgprobe-$(openssl rand -hex 3)"
for loc in westus2 centralus eastus2 westus3 southcentralus eastus; do
  echo "--- $loc"
  if az postgres flexible-server create -n "$N" -g rg-pgprobe -l $loc --admin-user probeadmin \
       --admin-password "$PW" --tier Burstable --sku-name Standard_B1ms --storage-size 32 \
       --version 16 --public-access None --yes -o none 2>&1 | grep ERROR; then
    # failed: wait until the half-created server is gone before the next try
    while az postgres flexible-server show -n "$N" -g rg-pgprobe >/dev/null 2>&1; do sleep 15; done
  else
    echo "WORKS: $loc"; break
  fi
done
az group delete -n rg-pgprobe --yes        # always clean up the probe
```

Use the region that printed `WORKS` as `<REGION>` for **both** dev and prod.
Keeping the app and its database in the same region avoids slow cross-region
database calls.

> To get a blocked region opened, file an Azure support request: **Help +
> support → Create a support request → Service and subscription limits
> (quotas) → Azure Database for PostgreSQL Flexible Server**. It usually takes
> 1–3 business days.

### 4.3 Run the setup script

`setup.sh` is idempotent: if it fails partway, fix the cause and **run the
same command again**. It reuses whatever already exists.

Two values are critical:

- **`GITHUB_REPO` must be the customer's repo.** Azure only trusts deploys from the repo named here, and the default is the reference repo.
- **`LOCATION`** is the region from 4.2.

```bash
cd "/e/Bookkeeping Project/bookkeeping-project"
git checkout dev && git pull isp dev
export MSYS_NO_PATHCONV=1

LOCATION=<REGION> GITHUB_REPO=<CUSTOMER_GH>/<REPO> bash infra/azure/setup.sh 2>&1 | tee setup.log
```

**One run sets up both environments.** It takes about 15–20 minutes and
creates **one shared stack** in `rg-bookkeeping`. Only the apps, the databases
and the deploy identities exist once per environment:

| Resource | Name pattern | Shared? |
|---|---|---|
| Key Vault: `pg-password`, `jwt-secret-key-dev`, `jwt-secret-key-prod` (generated once; separate JWT keys so a dev login token is never valid on prod) | `kv-bookkeeping-xxxxxx` | shared |
| Managed identity: the apps use it to read Key Vault and pull images | `id-bookkeeping` | shared |
| Container registry (Basic): dev's `sha-…` and prod's `vX.Y.Z` tags side by side | `acrbookkeepingxxxxxx` | shared |
| Postgres Flexible Server B1ms, 32 GB, v16, with **one database per environment**: `erd_db` (prod) and `erd_db_dev` (dev) | `pg-bookkeeping-xxxxxx` | server shared, databases separate |
| Container Apps environment | `cae-bookkeeping` | shared |
| Container App (public, scale to zero, health checks on `/health`) | `ca-bookkeeping-dev`, `ca-bookkeeping-prod` | one each |
| Entra app with a GitHub OIDC trust for one GitHub environment, allowed to deploy **only that environment's app** | `gh-bookkeeping-dev-deploy`, `gh-bookkeeping-prod-deploy` | one each |

Separate databases mean a dev migration or test can never touch prod's
tables, and dev can be reset by dropping `erd_db_dev`.

At the end the script prints a box per environment like this. **Save the
output**; you need it in step 5:

```
 dev app:  https://ca-bookkeeping-dev.<random>.<REGION>.azurecontainerapps.io   (database erd_db_dev)
 In GitHub: Settings -> Environments -> "dev" -> Environment variables
   AZURE_CLIENT_ID        ...          <- differs between dev and prod
   AZURE_TENANT_ID        ...
   AZURE_SUBSCRIPTION_ID  ...
   AZURE_RESOURCE_GROUP   rg-bookkeeping
   AZURE_ACR_NAME         acrbookkeeping...
   AZURE_APP              ca-bookkeeping-dev   <- differs between dev and prod
```

### 4.4 Verify Azure (both environments)

```bash
export MSYS_NO_PATHCONV=1
RG=rg-bookkeeping
echo "shared app identity roles (expect Key Vault Secrets User + AcrPull):"
az role assignment list --assignee "$(az identity show -n id-bookkeeping -g $RG --query principalId -o tsv)" \
  --all --query "[].roleDefinitionName" -o tsv
PG=$(az postgres flexible-server list -g $RG --query '[0].name' -o tsv)
echo "Postgres firewall (expect AllowAllAzureServices...):"
az postgres flexible-server firewall-rule list -g $RG --server-name "$PG" --query "[].name" -o tsv
echo "databases (expect erd_db and erd_db_dev among them):"
az postgres flexible-server db list -g $RG --server-name "$PG" --query "[].name" -o tsv
for env in dev prod; do
  echo "=== $env"
  az containerapp show -n ca-bookkeeping-$env -g $RG --query "{
    db: properties.template.containers[0].env[?name=='POSTGRES_DB'].value | [0],
    probes: join(' ', properties.template.containers[0].probes[].type)}" -o tsv
done
```

**Expect:** both roles, the firewall rule, both databases, and per app the
right database (`erd_db_dev` for dev, `erd_db` for prod) plus `Liveness
Readiness Startup`. If anything is missing, run `setup.sh` again.

---

## 5. Configure the GitHub repo

All of these work on the empty repo, before any code is pushed. Set them in a
Git Bash window logged in with `gh`:

```bash
R=<CUSTOMER_GH>/<REPO>
```

### 5.1 Environments and their variables

Create both environments, then paste the six values from each box in
`setup.log`. Only `AZURE_CLIENT_ID` and `AZURE_APP` differ between them:

```bash
gh api -X PUT repos/$R/environments/dev  -q .name
gh api -X PUT repos/$R/environments/prod -q .name

# dev — values from the "dev" box in setup.log
while read k v; do gh variable set "$k" -R $R --env dev --body "$v"; done <<'EOF'
AZURE_CLIENT_ID <from dev box>
AZURE_TENANT_ID <from box>
AZURE_SUBSCRIPTION_ID <from box>
AZURE_RESOURCE_GROUP rg-bookkeeping
AZURE_ACR_NAME <from box>
AZURE_APP ca-bookkeeping-dev
EOF

# prod — values from the "prod" box in setup.log
while read k v; do gh variable set "$k" -R $R --env prod --body "$v"; done <<'EOF'
AZURE_CLIENT_ID <from prod box>
AZURE_TENANT_ID <from box>
AZURE_SUBSCRIPTION_ID <from box>
AZURE_RESOURCE_GROUP rg-bookkeeping
AZURE_ACR_NAME <from box>
AZURE_APP ca-bookkeeping-prod
EOF

for e in dev prod; do echo "$e: $(gh variable list -R $R --env $e --json name -q '[.[].name]|join(",")')"; done
```

These are **variables, not secrets**: they're IDs, not passwords.

### 5.2 Let Actions open pull requests (needed for the release PR)

```bash
echo '{"default_workflow_permissions":"read","can_approve_pull_request_reviews":true}' \
  | gh api -X PUT repos/$R/actions/permissions/workflow --input -
gh api repos/$R/actions/permissions/workflow     # expect can_approve_pull_request_reviews: true
```

> Send the setting as JSON exactly like this. With `-F ...=true` the value
> was silently not applied.

**If the customer uses an organization,** an org policy can block this setting.
Check *Org → Settings → Actions → General → Workflow permissions* first.

UI equivalent: repo **Settings → Actions → General → Workflow permissions →
tick "Allow GitHub Actions to create and approve pull requests"**.

### 5.3 Merge settings

```bash
gh api -X PATCH repos/$R -F allow_squash_merge=true -F allow_merge_commit=true \
  -F allow_rebase_merge=false -f squash_merge_commit_title=PR_TITLE \
  -f squash_merge_commit_message=PR_BODY -F delete_branch_on_merge=true \
  -q '{allow_squash_merge, allow_merge_commit, allow_rebase_merge, squash_merge_commit_title, delete_branch_on_merge}'
```

- Feature PRs into `dev` are **squash-merged**, and the PR title becomes the commit message that drives the version number.
- The release PR `dev → prod` uses a **merge commit**.

### 5.4 Security features

```bash
gh api -X PUT repos/$R/vulnerability-alerts
gh api -X PUT repos/$R/automated-security-fixes
echo '{"security_and_analysis":{"secret_scanning":{"status":"enabled"},"secret_scanning_push_protection":{"status":"enabled"}}}' \
  | gh api -X PATCH repos/$R --input - -q .security_and_analysis
```

> On private repos, secret scanning may need **GitHub Secret Protection**,
> a paid add-on. If the last command errors, skip it. Dependabot works on
> every plan.

Branch protection and the default branch come **after** the first push (step 6), because the branches have to exist first.

---

## 6. First deploy and verification

### 6.1 Push `dev` and `prod` (same commit)

Pushing the **same commit** to both branches deploys both environments in
one go. The release-PR step then finds nothing to release, because `dev`
equals `prod`.

```bash
git fetch isp
git push customer isp/dev:refs/heads/prod isp/dev:refs/heads/dev
```

Don't push tags. The customer's version history starts fresh, at
`v0.1.0` or similar, computed from the commit messages.

Two workflows start:

| Workflow | Does |
|---|---|
| **Deploy dev** | builds the image, deploys it to dev, smoke-tests it |
| **Release prod** | builds the image, deploys it to prod, smoke-tests it, creates tag `vX.Y.Z` and a GitHub Release |

Watch them:

```bash
gh run list -R $R -L 5
gh run watch -R $R <run-id> --exit-status
```

### 6.2 Default branch and branch protection

```bash
gh repo edit $R --default-branch dev

# dev: PRs only, the 4 CI checks must pass, no force-push/deletion, admins included
cat <<'EOF' | gh api -X PUT repos/$R/branches/dev/protection --input - -q '.required_status_checks.contexts'
{"required_status_checks":{"strict":false,"contexts":["PR title (conventional)","Backend lint & tests","Frontend lint, tests & build","Docker image build & scan"]},
 "enforce_admins":true,
 "required_pull_request_reviews":{"required_approving_review_count":0},
 "restrictions":null,"allow_force_pushes":false,"allow_deletions":false}
EOF

# prod: PRs only, no force-push/deletion. No required checks: the release PR
# is opened by the workflow token, and GitHub doesn't run CI on those PRs.
cat <<'EOF' | gh api -X PUT repos/$R/branches/prod/protection --input - -q '.enforce_admins.enabled'
{"required_status_checks":null,
 "enforce_admins":true,
 "required_pull_request_reviews":{"required_approving_review_count":0},
 "restrictions":null,"allow_force_pushes":false,"allow_deletions":false}
EOF
```

### 6.3 Check the live apps

`setup.sh` printed each app's URL, `https://ca-bookkeeping-<env>.<random>.<REGION>.azurecontainerapps.io`.
You can also get them with:

```bash
for env in dev prod; do
  echo "$env: https://$(az containerapp show -n ca-bookkeeping-$env -g rg-bookkeeping --query properties.configuration.ingress.fqdn -o tsv)"
done
```

For each URL (the first request after idle takes a few seconds; the app scales to zero):

```bash
U=https://ca-bookkeeping-dev.<...>.azurecontainerapps.io
curl -s $U/health                       # {"status":"ok","version":"sha-xxxxxxx"}   (prod: "vX.Y.Z")
curl -s -o /dev/null -w '%{http_code}\n' $U/                  # 200
curl -s -o /dev/null -w '%{http_code}\n' $U/invoices/issued   # 200 (page links work)
curl -s -o /dev/null -w '%{http_code}\n' -X POST $U/api/v1/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"smoke@example.com","password":"x"}'   # 401
```

If an app isn't healthy, see [Troubleshooting](#10-troubleshooting), starting
with "App never becomes healthy".

---

## 7. Create the first logins

There's **no sign-up page**; accounts are created by an admin with a script
inside the running app. Roles: `admin` (everything), `editor` (create and edit
documents), `viewer` (read-only).

**Option A: Azure Portal (easiest)**

1. Open the app's URL once, to wake it up.
2. Azure Portal → **Container Apps** → `ca-bookkeeping-dev` → **Monitoring → Console** → pick the container → **`/bin/sh`** → **Connect**.
3. Type:
   ```sh
   python scripts/create_user.py --email owner@customer.com --password 'StrongPassword!' --full-name 'Owner Name' --role admin
   ```
4. It should print `Created user: owner@customer.com (admin)`.

**Option B: PowerShell (not Git Bash)**

```powershell
az containerapp exec -g rg-bookkeeping -n ca-bookkeeping-dev
# inside the container shell:
python scripts/create_user.py --email owner@customer.com --password 'StrongPassword!' --full-name 'Owner Name' --role admin
exit
```

Open the shell first and type the command inside it. Don't put the whole
line in `--command "..."`: Azure doesn't run it through a shell, so quotes
around names with spaces break.

Repeat on prod with `ca-bookkeeping-prod`. Dev and prod have separate databases, so each needs its own users.

**Resetting a password** is the same command with the same email and a new
password: the script updates an existing user.

---

## 8. Day-to-day workflow

```
feature/x ──PR (CI)──▶ dev ──auto deploy──▶ Azure dev
                        │
                        └─ auto-opens/updates PR "release: vX.Y.Z"  dev ──▶ prod
                                                                     │ merge (merge commit)
                                                                     ▼
                                    Azure prod  ◀──auto deploy── prod ──▶ tag vX.Y.Z + GitHub Release
```

1. **Start a change:** branch off `dev`, then open a PR into `dev`. Its title must follow Conventional Commits:
   - `feat: …` bumps the minor version.
   - `fix: …`, `chore: …`, `docs: …` bump the patch version.
   - `feat!: …` bumps the major version.
2. **CI must pass:** lint, tests, a Docker build and a vulnerability scan. Then click **Squash and merge**.
3. **Dev deploys automatically.** Test on the dev URL.
4. **Release:** merge the auto-opened `release: vX.Y.Z` PR with **Create a merge commit**. Prod then runs the **exact image that was tested on dev**; it isn't rebuilt.
5. **Changelog:** move `CHANGELOG.md`'s `Unreleased` entries under the new version.

**Dependabot** opens weekly update PRs into `dev`. Merge them when CI is green. It ignores odd-numbered Node versions, which have no long-term support.

**Hotfix:** branch from `prod`, PR into `prod`, then merge `prod` back into `dev`.

**Rollback:**
```bash
az containerapp update -g rg-bookkeeping -n ca-bookkeeping-prod \
  --image <acr>.azurecr.io/bookkeeping:<older vX.Y.Z>
```
Database migrations only go forward, so check before rolling back across a schema change.

**Logs:** each start logs the version and which settings are present (never their values).
```powershell
az containerapp logs show -g rg-bookkeeping -n ca-bookkeeping-prod --follow
```

**Rotate a secret:** set a new version in Key Vault, then restart the app.
Changing `pg-password` also needs
`az postgres flexible-server update --admin-password <new>` on the server.

---

## 9. Costs and budget alert

These are approximate US list prices per month, for low traffic:

| Item | Monthly (dev + prod together) |
|---|---|
| Postgres Flexible Server B1ms + 32 GB, shared (two databases) | ~$16 |
| Container registry (Basic), shared | ~$5 |
| Two Container Apps: scale to zero, within the free monthly allowance | ~$0 |
| Key Vault, logs | cents |
| **Total** | **~$21** |

Plus the GitHub plan from [1](#github) (~$4 per user per month for a private repo).

**Set a budget alert** so a surprise bill can't creep in: Azure Portal →
**Cost Management → Budgets → Add** → scope: the subscription, amount e.g.
$60 per month, alert at 80% and 100% to the customer's email (and yours).

Dev and prod already share everything that's billed. Only the two apps and
the two databases exist per environment, and those cost nothing extra.

---

## 10. Troubleshooting

Every one of these happened during the reference deployment. **After fixing
any of them, re-run the same `setup.sh` command**; it picks up where it
stopped.

| Symptom | Cause | Fix |
|---|---|---|
| `MissingSubscriptionRegistration ... namespace 'Microsoft.KeyVault'` (or another namespace) | New subscription: that service type isn't registered | Fixed in `setup.sh` (it registers all six). Manually: `az provider register --namespace Microsoft.KeyVault --wait` |
| `The location is restricted from performing this operation` at the PostgreSQL step | Region blocked for new Postgres servers on this subscription | Pick another region ([4.2](#42-pick-a-region-that-accepts-postgres)) or file a support request |
| `SkuNotAvailable: Specified SKU is not supported in this region` | The B1ms size is blocked in that region for this subscription, in every zone | Pick another region ([4.2](#42-pick-a-region-that-accepts-postgres)) |
| Postgres server shows state **`Dropping`**, or `server name is already used` | A failed create leaves a half-made server that Azure deletes over ~2 minutes | Wait until `az postgres flexible-server show` returns not found, then retry |
| `ResourceNotFound` right after something was created (registry, Postgres) | Azure briefly reports a just-created resource as missing | `setup.sh` retries these; just re-run it |
| `The specified vault ... already exists` | Same lag in the other direction: a check briefly missed an existing vault | Re-run `setup.sh` (checks ask three times) |
| `ForbiddenByRbac` reading a Key Vault secret | The role was granted seconds earlier and hasn't reached every Key Vault node yet | `setup.sh` retries; re-run it. Persistent? `az role assignment list --scope <vault id>` must show **Key Vault Secrets Officer** for you |
| Key Vault name taken after deleting a resource group | Deleted vaults are kept for 90 days | `az keyvault list-deleted`, then `az keyvault purge -n <name> -l <old region>` |
| Setup stopped and you want to start over | Partial resources left behind | Delete `rg-bookkeeping`, then purge its vault (`az keyvault purge`), then re-run `setup.sh` |
| Role assignments lost after deleting and recreating a resource group with the same names | The grants were on the old resource IDs | Re-run `setup.sh`, which re-creates them, then check [4.4](#44-verify-azure-both-environments) |
| `the following arguments are required: --name/-n` on `postgres flexible-server db create` or `firewall-rule create` | Azure CLI 2.91 renamed options (`--server-name`, `--name`) | Fixed in `setup.sh`. Use the long option names in your own commands |
| Role assignment fails with a path like `C:/Program Files/Git/subscriptions/...` | Git Bash rewrote the Azure ID | `export MSYS_NO_PATHCONV=1` |
| `az containerapp exec` errors or hangs in Git Bash | It needs a real interactive terminal | Use PowerShell, or Portal → Console |
| **App never becomes healthy**; revision `ActivationFailed`; log shows the settings as `set`, then nothing until `Terminated` | The app can't reach Postgres: the firewall rule is missing (happened when the create command errored after making the server) | Check: `az postgres flexible-server firewall-rule list -g <rg> --server-name <pg>`. Fix: re-run `setup.sh` (it now always adds the rule), then start a fresh revision: `az containerapp update -n <app> -g <rg> --revision-suffix fix1` |
| `MaxNumberOfRegionalEnvironmentsInSubExceeded ... cannot have more than 2 Container App Environments` | A subscription allows 2 Container Apps environments per region by default (old per-environment stacks can use both) | Delete unused environments or their resource groups, or request a quota increase. The shared layout needs only one |
| Revision stays `ActivationFailed` after fixing the cause | Restarting a failed revision doesn't bring it back | Start a new one: `az containerapp update ... --revision-suffix <new>` |
| Deploy's **smoke test** retries until timeout although the app works | The test email used a reserved domain, so the API answered 422, not 401 | Fixed by PR #24 (`smoke@example.com`) |
| Release-PR step: `GitHub Actions is not permitted to create or approve pull requests` | Repo or org setting | [5.2](#52-let-actions-open-pull-requests-needed-for-the-release-pr) |
| Deploy job: `Azure variables are not set` (deploy skipped) | Environment variables are missing or in the wrong environment | [5.1](#51-environments-and-their-variables) |
| Azure login in a workflow: `AADSTS70021 ... no matching federated identity record` | `setup.sh` was run with the wrong `GITHUB_REPO`, or the environment name doesn't match | Re-run `setup.sh` with `GITHUB_REPO=<CUSTOMER_GH>/<REPO>` |
| Local Docker API crashes with `ModuleNotFoundError` after pulling changes | The image predates new Python packages | `docker compose up -d --build --renew-anon-volumes` |

Useful diagnostics:

```bash
# Revision states
az containerapp revision list -n ca-bookkeeping-dev -g rg-bookkeeping \
  --query "[].{rev:name, active:properties.active, health:properties.healthState, state:properties.runningState}" -o table

# App console output for one revision (Log Analytics; extension installs once)
az extension add -n log-analytics -y
WS=$(az containerapp env show -n cae-bookkeeping -g rg-bookkeeping \
  --query properties.appLogsConfiguration.logAnalyticsConfiguration.customerId -o tsv)
az monitor log-analytics query -w "$WS" -o table --analytics-query \
  "ContainerAppConsoleLogs_CL | where RevisionName_s == '<revision>' | order by TimeGenerated asc | project TimeGenerated, Log_s | take 50"

# Failed workflow step output
gh run view <run-id> -R $R --log-failed
```

---

## 11. Handover checklist

Azure:
- [ ] Customer subscription; you're Owner, plus Application Developer if you're a guest
- [ ] Region chosen with the probe (4.2); probe resource group deleted
- [ ] `setup.sh` finished with "Shared stack is provisioned", using `GITHUB_REPO=<CUSTOMER_GH>/<REPO>`
- [ ] 4.4 checks pass (roles, firewall, both databases, each app on its own database, health checks)
- [ ] Budget alert created

GitHub:
- [ ] Private repo on a paid plan (Pro or Team)
- [ ] `dev` and `prod` environments, each with 6 `AZURE_*` variables
- [ ] Actions may create PRs; merge settings; security features
- [ ] Both branches pushed (same commit); Deploy dev and Release prod both green
- [ ] Default branch `dev`; branch protection on `dev` and `prod`

App:
- [ ] `/health` OK on both URLs; prod shows `vX.Y.Z`
- [ ] Admin users created on dev and prod; customer can log in
- [ ] Customer has the URLs and knows the workflow in [8](#8-day-to-day-workflow)

Access after handover (agree this with the customer):
- [ ] Customer is Owner of the subscription and the GitHub org; you keep only the access you need
- [ ] Secrets stay in Key Vault, and nobody needs to know them: the app reads them directly
