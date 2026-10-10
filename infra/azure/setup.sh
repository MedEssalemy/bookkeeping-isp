#!/usr/bin/env bash
# One-time provisioning of the Azure stack shared by dev and prod.
#
#   az login
#   az account set --subscription <id>
#   GITHUB_REPO=<owner>/<repo> ./infra/azure/setup.sh
#
# Creates (idempotently, safe to re-run) in ONE resource group:
#   - Key Vault (RBAC): pg-password, plus one JWT key per environment so a dev
#     login token is never valid on prod
#   - user-assigned managed identity (reads Key Vault, pulls from the registry)
#   - container registry (one image repo; dev and prod tags side by side)
#   - one PostgreSQL Flexible Server with one database per environment:
#     erd_db (prod) and erd_db_dev (dev)
#   - one Container Apps environment with one app per environment:
#     ca-<prefix>-dev and ca-<prefix>-prod
#   - per environment, an Entra app with a GitHub OIDC credential that may
#     deploy only that environment's app
# Prints the GitHub environment variables to set at the end.
#
# Optional env overrides: LOCATION, PREFIX, GITHUB_REPO, PG_SKU.
set -euo pipefail

# West US 2: on this (new pay-as-you-go) subscription, East US refuses new
# Postgres servers and East US 2 refuses the B1ms size; West US 2 accepts both.
LOCATION="${LOCATION:-westus2}"
PREFIX="${PREFIX:-bookkeeping}"
GITHUB_REPO="${GITHUB_REPO:-MedEssalemy/bookkeeping-isp}"
PG_SKU="${PG_SKU:-Standard_B1ms}"
ENVIRONMENTS="dev prod"

SUB_ID="$(az account show --query id -o tsv)"
TENANT_ID="$(az account show --query tenantId -o tsv)"
# Short stable suffix for globally-unique names (Key Vault, ACR, Postgres).
SUFFIX="$(printf '%s' "$SUB_ID$PREFIX" | sha1sum | cut -c1-6)"

RG="rg-$PREFIX"
KV="kv-$PREFIX-$SUFFIX"; KV="${KV:0:24}"
ACR="acr${PREFIX//-/}${SUFFIX}"; ACR="${ACR:0:50}"
PG="pg-$PREFIX-$SUFFIX"
PG_ADMIN="bkadmin"
IDENTITY="id-$PREFIX"
CAE="cae-$PREFIX"
# Public placeholder until the first pipeline run replaces it.
PLACEHOLDER="mcr.microsoft.com/k8se/quickstart:latest"

app_name()  { echo "ca-$PREFIX-$1"; }
db_name()   { if [ "$1" = prod ]; then echo erd_db; else echo "erd_db_$1"; fi; }
jwt_name()  { echo "jwt-secret-key-$1"; }
gh_name()   { echo "gh-$PREFIX-$1-deploy"; }

step() { printf '\n==> %s\n' "$*"; }
# Reads right after a change are sometimes briefly wrong (a vault that exists
# reported missing); ask three times before concluding something is absent.
exists() {
  for _ in 1 2 3; do
    if "$@" >/dev/null 2>&1; then return 0; fi
    sleep 5
  done
  return 1
}
# A resource can be missing from reads for a little while right after it is
# created (seen with ACR, Postgres, Key Vault RBAC); retry for up to two minutes.
retry() {
  for _ in $(seq 1 12); do
    if "$@"; then return 0; fi
    sleep 10
  done
  return 1
}
grant() {  # grant <principal-id> <role> <scope>; idempotent
  az role assignment create --assignee-object-id "$1" --assignee-principal-type ServicePrincipal \
    --role "$2" --scope "$3" -o none 2>/dev/null || true
}

az extension add --name containerapp --upgrade --only-show-errors
# A new subscription has none of these registered yet; registering is a no-op
# when it already is. One per Azure service this script creates.
for ns in Microsoft.App Microsoft.OperationalInsights Microsoft.KeyVault \
          Microsoft.ManagedIdentity Microsoft.ContainerRegistry Microsoft.DBforPostgreSQL; do
  az provider register --namespace "$ns" --wait >/dev/null
done

step "Resource group $RG ($LOCATION)"
az group create -n "$RG" -l "$LOCATION" -o none

step "Key Vault $KV"
if ! exists az keyvault show -n "$KV" -g "$RG"; then
  az keyvault create -n "$KV" -g "$RG" -l "$LOCATION" --enable-rbac-authorization true -o none
fi
KV_ID="$(retry az keyvault show -n "$KV" -g "$RG" --query id -o tsv 2>/dev/null)"
KV_URI="$(az keyvault show -n "$KV" -g "$RG" --query properties.vaultUri -o tsv)"; KV_URI="${KV_URI%/}"
ME="$(az ad signed-in-user show --query id -o tsv)"
az role assignment create --assignee-object-id "$ME" --assignee-principal-type User \
  --role "Key Vault Secrets Officer" --scope "$KV_ID" -o none 2>/dev/null || true

# Generate secrets once; never overwrite (the DB password must stay in sync).
ensure_secret() {
  local name="$1" value
  if exists az keyvault secret show --vault-name "$KV" -n "$name"; then
    echo "   secret $name already present"
    return
  fi
  value="$(openssl rand -base64 36 | tr -d '/+=' | cut -c1-40)"
  for _ in $(seq 1 12); do   # RBAC role assignment can take a minute to propagate
    if az keyvault secret set --vault-name "$KV" -n "$name" --value "$value" -o none 2>/dev/null; then
      echo "   secret $name created"
      return
    fi
    sleep 10
  done
  echo "Could not write secret $name to $KV" >&2
  exit 1
}
ensure_secret pg-password
for env in $ENVIRONMENTS; do ensure_secret "$(jwt_name "$env")"; done
# The role grant above can take a minute to reach every Key Vault node.
PG_PASSWORD="$(retry az keyvault secret show --vault-name "$KV" -n pg-password --query value -o tsv 2>/dev/null)"

step "Managed identity $IDENTITY"
az identity create -n "$IDENTITY" -g "$RG" -l "$LOCATION" -o none
ID_RES="$(retry az identity show -n "$IDENTITY" -g "$RG" --query id -o tsv 2>/dev/null)"
ID_PRINCIPAL="$(az identity show -n "$IDENTITY" -g "$RG" --query principalId -o tsv)"
grant "$ID_PRINCIPAL" "Key Vault Secrets User" "$KV_ID"

step "Container registry $ACR"
if ! exists az acr show -n "$ACR" -g "$RG"; then
  az acr create -n "$ACR" -g "$RG" -l "$LOCATION" --sku Basic -o none
fi
ACR_ID="$(retry az acr show -n "$ACR" -g "$RG" --query id -o tsv 2>/dev/null)"
grant "$ID_PRINCIPAL" AcrPull "$ACR_ID"

step "PostgreSQL $PG (this takes several minutes the first time)"
if ! exists az postgres flexible-server show -n "$PG" -g "$RG"; then
  # --public-access 0.0.0.0 = only Azure services may connect. Harden with VNet
  # integration later if needed.
  az postgres flexible-server create -n "$PG" -g "$RG" -l "$LOCATION" \
    --admin-user "$PG_ADMIN" --admin-password "$PG_PASSWORD" \
    --tier Burstable --sku-name "$PG_SKU" --storage-size 32 --version 16 \
    --public-access 0.0.0.0 --yes -o none \
    || echo "   create reported an error; checking whether the server exists anyway..."
fi
# The CLI's own read-back right after creating can 404 although the server is
# fine. Wait for it to be Ready; a real failure (e.g. SkuNotAvailable) leaves
# no server, so this times out and stops the script.
PG_STATE="$(retry az postgres flexible-server show -n "$PG" -g "$RG" --query state -o tsv 2>/dev/null)"
until [ "$PG_STATE" = "Ready" ]; do
  echo "   server state: $PG_STATE"
  sleep 20
  PG_STATE="$(az postgres flexible-server show -n "$PG" -g "$RG" --query state -o tsv)"
done
# --public-access 0.0.0.0 normally adds this rule, but not when the create
# command fails after the server exists (the read-back 404 above). Without it
# nothing in Azure can connect and the app hangs on its first migration.
retry az postgres flexible-server firewall-rule create --resource-group "$RG" --server-name "$PG" \
  --name AllowAllAzureServicesAndResourcesWithinAzureIps \
  --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0 -o none --only-show-errors
# One database per environment on the shared server: a dev migration or test
# can never touch prod's tables, and dev can be reset by dropping its database.
for env in $ENVIRONMENTS; do
  retry az postgres flexible-server db create --resource-group "$RG" --server-name "$PG" \
    --name "$(db_name "$env")" -o none
  echo "   database $(db_name "$env") ($env)"
done
PG_HOST="$(az postgres flexible-server show -n "$PG" -g "$RG" --query fullyQualifiedDomainName -o tsv)"

step "Container Apps environment $CAE"
if ! exists az containerapp env show -n "$CAE" -g "$RG"; then
  az containerapp env create -n "$CAE" -g "$RG" -l "$LOCATION" -o none
fi
CAE_ID="$(retry az containerapp env show -n "$CAE" -g "$RG" --query id -o tsv 2>/dev/null)"

declare -A APP_FQDN CLIENT_ID
for env in $ENVIRONMENTS; do
  APP="$(app_name "$env")"
  step "App $APP (public ingress, database $(db_name "$env"))"
  # Scale to zero: within the free monthly grant at this usage; the first request
  # after an idle period waits for a cold start. Max 1 replica keeps start.sh's
  # migrations from running twice at once.
  if ! exists az containerapp show -n "$APP" -g "$RG"; then
    az containerapp create -n "$APP" -g "$RG" --environment "$CAE" \
      --image "$PLACEHOLDER" --target-port 8000 --ingress external \
      --user-assigned "$ID_RES" --registry-server "$ACR.azurecr.io" --registry-identity "$ID_RES" \
      --min-replicas 0 --max-replicas 1 --cpu 0.5 --memory 1.0Gi -o none
  fi
  # Secrets are Key Vault references resolved by the managed identity: the
  # values never live in the Container App or in GitHub.
  retry az containerapp secret set -n "$APP" -g "$RG" -o none --secrets \
    "pg-password=keyvaultref:$KV_URI/secrets/pg-password,identityref:$ID_RES" \
    "jwt-secret-key=keyvaultref:$KV_URI/secrets/$(jwt_name "$env"),identityref:$ID_RES"
  az containerapp update -n "$APP" -g "$RG" -o none --set-env-vars \
    "POSTGRES_HOST=$PG_HOST" "POSTGRES_PORT=5432" "POSTGRES_DB=$(db_name "$env")" \
    "POSTGRES_USER=$PG_ADMIN" "POSTGRES_SSLMODE=require" \
    "POSTGRES_PASSWORD=secretref:pg-password" "JWT_SECRET_KEY=secretref:jwt-secret-key"
  # Health probes on /health instead of the default TCP check on the port.
  # Startup allows ~100 s for migrations + seeding; liveness restarts a hung
  # process; readiness keeps traffic off a replica that stops answering.
  PROBE='"httpGet":{"path":"/health","port":8000}'
  APP_RES_ID="$(az containerapp show -n "$APP" -g "$RG" --query id -o tsv)"
  az resource update --ids "$APP_RES_ID" -o none --set "properties.template.containers[0].probes=[
    {\"type\":\"Startup\",$PROBE,\"initialDelaySeconds\":5,\"periodSeconds\":10,\"failureThreshold\":10},
    {\"type\":\"Liveness\",$PROBE,\"periodSeconds\":30,\"failureThreshold\":3},
    {\"type\":\"Readiness\",$PROBE,\"periodSeconds\":10,\"failureThreshold\":3}]"
  APP_FQDN[$env]="$(az containerapp show -n "$APP" -g "$RG" --query properties.configuration.ingress.fqdn -o tsv)"

  GH_APP="$(gh_name "$env")"
  step "GitHub OIDC deploy identity $GH_APP (may deploy $APP only)"
  APP_ID="$(az ad app list --display-name "$GH_APP" --query '[0].appId' -o tsv)"
  if [ -z "$APP_ID" ]; then
    APP_ID="$(az ad app create --display-name "$GH_APP" --query appId -o tsv)"
  fi
  exists az ad sp show --id "$APP_ID" || az ad sp create --id "$APP_ID" -o none
  SP_ID="$(retry az ad sp show --id "$APP_ID" --query id -o tsv 2>/dev/null)"
  CRED_NAME="github-$env"
  if [ -z "$(az ad app federated-credential list --id "$APP_ID" --query "[?name=='$CRED_NAME'].name" -o tsv)" ]; then
    az ad app federated-credential create --id "$APP_ID" -o none --parameters "{
      \"name\": \"$CRED_NAME\",
      \"issuer\": \"https://token.actions.githubusercontent.com\",
      \"subject\": \"repo:$GITHUB_REPO:environment:$env\",
      \"audiences\": [\"api://AzureADTokenExchange\"]
    }"
  fi
  # Just enough to roll out a new image to this one app: change the app, import
  # into the shared registry, attach to the shared environment, and keep the
  # app's managed identity attached. Nothing on the other environment's app.
  grant "$SP_ID" Contributor "$APP_RES_ID"
  grant "$SP_ID" Contributor "$ACR_ID"
  grant "$SP_ID" Contributor "$CAE_ID"
  grant "$SP_ID" "Managed Identity Operator" "$ID_RES"
  CLIENT_ID[$env]="$APP_ID"
done

echo
echo "============================================================"
echo " Shared stack is provisioned in $RG ($LOCATION)."
for env in $ENVIRONMENTS; do
  cat <<EOF

 $env app:  https://${APP_FQDN[$env]}   (database $(db_name "$env"))
 In GitHub: Settings -> Environments -> "$env" -> Environment variables
   AZURE_CLIENT_ID        ${CLIENT_ID[$env]}
   AZURE_TENANT_ID        $TENANT_ID
   AZURE_SUBSCRIPTION_ID  $SUB_ID
   AZURE_RESOURCE_GROUP   $RG
   AZURE_ACR_NAME         $ACR
   AZURE_APP              $(app_name "$env")
EOF
done
cat <<EOF

 Secrets live in Key Vault $KV (pg-password, $(jwt_name dev), $(jwt_name prod)).
 Create the first login after the first deploy: Azure Portal -> Container Apps ->
 <app> -> Monitoring -> Console -> /bin/sh, then run
   python scripts/create_user.py --email you@company.com --password '<strong>' --full-name 'Your Name' --role admin
============================================================
EOF
