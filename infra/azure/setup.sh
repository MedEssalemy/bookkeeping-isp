#!/usr/bin/env bash
# One-time provisioning of one environment (dev or prod) on Azure Container Apps.
#
#   az login
#   az account set --subscription <id>
#   ./infra/azure/setup.sh dev        # then again with: prod
#
# Creates (idempotently, safe to re-run):
#   resource group, Key Vault (RBAC) holding the app secrets, user-assigned
#   managed identity (reads Key Vault, pulls from ACR), Azure Container Registry,
#   PostgreSQL Flexible Server + database, Container Apps environment,
#   one app (public ingress) serving the API and the built Vue UI,
#   and an Entra app with a GitHub OIDC federated credential for deployments.
# Prints the GitHub environment variables to set at the end.
#
# Optional env overrides: LOCATION, PREFIX, GITHUB_REPO, PG_SKU.
set -euo pipefail

ENV_NAME="${1:-}"
if [[ "$ENV_NAME" != "dev" && "$ENV_NAME" != "prod" ]]; then
  echo "usage: $0 dev|prod" >&2
  exit 1
fi

LOCATION="${LOCATION:-westeurope}"
PREFIX="${PREFIX:-bookkeeping}"
GITHUB_REPO="${GITHUB_REPO:-AbdellahElBouazzaoui/bookkeeping-project}"
PG_SKU="${PG_SKU:-Standard_B1ms}"

SUB_ID="$(az account show --query id -o tsv)"
TENANT_ID="$(az account show --query tenantId -o tsv)"
# Short stable suffix for globally-unique names (Key Vault, ACR, Postgres).
SUFFIX="$(printf '%s' "$SUB_ID$PREFIX" | sha1sum | cut -c1-6)"

RG="rg-$PREFIX-$ENV_NAME"
KV="kv-$PREFIX-$ENV_NAME-$SUFFIX"; KV="${KV:0:24}"
ACR="acr${PREFIX//-/}${ENV_NAME}${SUFFIX}"; ACR="${ACR:0:50}"
PG="pg-$PREFIX-$ENV_NAME-$SUFFIX"
PG_ADMIN="bkadmin"
PG_DB="erd_db"
IDENTITY="id-$PREFIX-$ENV_NAME"
CAE="cae-$PREFIX-$ENV_NAME"
APP="ca-$PREFIX-$ENV_NAME"
GH_APP="gh-$PREFIX-$ENV_NAME-deploy"
# Public placeholder until the first pipeline run replaces it.
PLACEHOLDER="mcr.microsoft.com/k8se/quickstart:latest"

step() { printf '\n==> %s\n' "$*"; }
exists() { "$@" >/dev/null 2>&1; }

az extension add --name containerapp --upgrade --only-show-errors
az provider register --namespace Microsoft.App --wait >/dev/null
az provider register --namespace Microsoft.OperationalInsights --wait >/dev/null

step "Resource group $RG ($LOCATION)"
az group create -n "$RG" -l "$LOCATION" -o none
RG_ID="$(az group show -n "$RG" --query id -o tsv)"

step "Key Vault $KV"
if ! exists az keyvault show -n "$KV" -g "$RG"; then
  az keyvault create -n "$KV" -g "$RG" -l "$LOCATION" --enable-rbac-authorization true -o none
fi
KV_ID="$(az keyvault show -n "$KV" -g "$RG" --query id -o tsv)"
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
ensure_secret jwt-secret-key
PG_PASSWORD="$(az keyvault secret show --vault-name "$KV" -n pg-password --query value -o tsv)"

step "Managed identity $IDENTITY"
az identity create -n "$IDENTITY" -g "$RG" -l "$LOCATION" -o none
ID_RES="$(az identity show -n "$IDENTITY" -g "$RG" --query id -o tsv)"
ID_PRINCIPAL="$(az identity show -n "$IDENTITY" -g "$RG" --query principalId -o tsv)"
az role assignment create --assignee-object-id "$ID_PRINCIPAL" --assignee-principal-type ServicePrincipal \
  --role "Key Vault Secrets User" --scope "$KV_ID" -o none 2>/dev/null || true

step "Container registry $ACR"
if ! exists az acr show -n "$ACR" -g "$RG"; then
  az acr create -n "$ACR" -g "$RG" -l "$LOCATION" --sku Basic -o none
fi
ACR_ID="$(az acr show -n "$ACR" -g "$RG" --query id -o tsv)"
az role assignment create --assignee-object-id "$ID_PRINCIPAL" --assignee-principal-type ServicePrincipal \
  --role AcrPull --scope "$ACR_ID" -o none 2>/dev/null || true

step "PostgreSQL $PG (this takes several minutes the first time)"
if ! exists az postgres flexible-server show -n "$PG" -g "$RG"; then
  # --public-access 0.0.0.0 = only Azure services may connect. Harden with VNet
  # integration later if needed.
  az postgres flexible-server create -n "$PG" -g "$RG" -l "$LOCATION" \
    --admin-user "$PG_ADMIN" --admin-password "$PG_PASSWORD" \
    --tier Burstable --sku-name "$PG_SKU" --storage-size 32 --version 16 \
    --public-access 0.0.0.0 --yes -o none
fi
az postgres flexible-server db create -g "$RG" -s "$PG" -d "$PG_DB" -o none
PG_HOST="$(az postgres flexible-server show -n "$PG" -g "$RG" --query fullyQualifiedDomainName -o tsv)"

step "Container Apps environment $CAE"
if ! exists az containerapp env show -n "$CAE" -g "$RG"; then
  az containerapp env create -n "$CAE" -g "$RG" -l "$LOCATION" -o none
fi

step "App $APP (public ingress)"
# Scale to zero: within the free monthly grant at this usage; the first request
# after an idle period waits for a cold start. Max 1 replica keeps start.sh's
# migrations from running twice at once.
if ! exists az containerapp show -n "$APP" -g "$RG"; then
  az containerapp create -n "$APP" -g "$RG" --environment "$CAE" \
    --image "$PLACEHOLDER" --target-port 8000 --ingress external \
    --user-assigned "$ID_RES" --registry-server "$ACR.azurecr.io" --registry-identity "$ID_RES" \
    --min-replicas 0 --max-replicas 1 --cpu 0.5 --memory 1.0Gi -o none
fi
# Secrets are Key Vault references resolved by the managed identity — the
# values never live in the Container App or in GitHub.
az containerapp secret set -n "$APP" -g "$RG" -o none --secrets \
  "pg-password=keyvaultref:$KV_URI/secrets/pg-password,identityref:$ID_RES" \
  "jwt-secret-key=keyvaultref:$KV_URI/secrets/jwt-secret-key,identityref:$ID_RES"
az containerapp update -n "$APP" -g "$RG" -o none --set-env-vars \
  "POSTGRES_HOST=$PG_HOST" "POSTGRES_PORT=5432" "POSTGRES_DB=$PG_DB" \
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
APP_FQDN="$(az containerapp show -n "$APP" -g "$RG" --query properties.configuration.ingress.fqdn -o tsv)"

step "GitHub OIDC deploy identity $GH_APP"
APP_ID="$(az ad app list --display-name "$GH_APP" --query '[0].appId' -o tsv)"
if [ -z "$APP_ID" ]; then
  APP_ID="$(az ad app create --display-name "$GH_APP" --query appId -o tsv)"
fi
exists az ad sp show --id "$APP_ID" || az ad sp create --id "$APP_ID" -o none
SP_ID="$(az ad sp show --id "$APP_ID" --query id -o tsv)"
CRED_NAME="github-$ENV_NAME"
if [ -z "$(az ad app federated-credential list --id "$APP_ID" --query "[?name=='$CRED_NAME'].name" -o tsv)" ]; then
  az ad app federated-credential create --id "$APP_ID" -o none --parameters "{
    \"name\": \"$CRED_NAME\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"repo:$GITHUB_REPO:environment:$ENV_NAME\",
    \"audiences\": [\"api://AzureADTokenExchange\"]
  }"
fi
# Contributor on this environment's resource group only.
az role assignment create --assignee-object-id "$SP_ID" --assignee-principal-type ServicePrincipal \
  --role Contributor --scope "$RG_ID" -o none 2>/dev/null || true

cat <<EOF

============================================================
 $ENV_NAME is provisioned.

 App URL (after the first deploy):  https://$APP_FQDN

 In GitHub: Settings -> Environments -> "$ENV_NAME" -> Environment variables
   AZURE_CLIENT_ID        $APP_ID
   AZURE_TENANT_ID        $TENANT_ID
   AZURE_SUBSCRIPTION_ID  $SUB_ID
   AZURE_RESOURCE_GROUP   $RG
   AZURE_ACR_NAME         $ACR
   AZURE_APP              $APP

 Secrets live in Key Vault $KV (pg-password, jwt-secret-key).
 Create the first login after the first deploy:
   az containerapp exec -g $RG -n $APP --command \\
     "python scripts/create_user.py --email you@company.com --password '<strong-password>' --full-name 'Your Name' --role admin"
============================================================
EOF
