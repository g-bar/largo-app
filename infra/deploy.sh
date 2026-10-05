#!/usr/bin/env bash
# Release a new version of the app: build images, run migrations, update the app.
# Seeding is one-time and is not part of a release.
#
# Prerequisites: `az login` as a user with access to the subscription, and
# `terraform apply` already run so the infrastructure and outputs exist.
#
# Usage:
#   ./infra/deploy.sh            # tag defaults to YYYY-MM-DD-N (auto-incrementing N)
#   ./infra/deploy.sh v1.2.3     # explicit tag
set -euo pipefail

cd "$(dirname "$0")"

# Read infrastructure names from Terraform outputs (no hardcoding).
registry=$(terraform output -raw registry_name)
registry_server=$(terraform output -raw registry_login_server)
app=$(terraform output -raw container_app_name)
job=$(terraform output -raw migrate_job_name)
rg=$(terraform output -raw resource_group)

# Determine the release tag.
if [[ $# -ge 1 ]]; then
  tag=$1
else
  # YYYY-MM-DD-N, where N is the next free number for today.
  date_part=$(date +%Y-%m-%d)
  n=1
  while az acr repository show-tags -n "$registry" --repository largo-app -o tsv 2>/dev/null \
        | grep -qx "${date_part}-${n}"; do
    n=$((n + 1))
  done
  tag="${date_part}-${n}"
fi

app_image="${registry_server}/largo-app:${tag}"
tools_image="${registry_server}/largo-tools:${tag}"

echo "==> Building images (tag: ${tag})"
# Build in the cloud for linux/amd64 from the repo root Dockerfile.
az acr build --registry "$registry" --image "largo-app:${tag}"   --target app   --platform linux/amd64 -f ../Dockerfile ..
az acr build --registry "$registry" --image "largo-tools:${tag}" --target tools --platform linux/amd64 -f ../Dockerfile ..

echo "==> Running migrations (${job})"
az containerapp job update -n "$job" -g "$rg" --image "$tools_image" -o none
exec_name=$(az containerapp job start -n "$job" -g "$rg" --query name -o tsv)
echo "    execution: ${exec_name}"

# Wait for the migration job to finish.
while true; do
  status=$(az containerapp job execution show -n "$job" -g "$rg" \
    --job-execution-name "$exec_name" --query properties.status -o tsv)
  case "$status" in
    Succeeded) echo "    migrations: Succeeded"; break ;;
    Failed|Stopped)
      echo "    migrations: ${status}" >&2
      az containerapp job logs show -n "$job" -g "$rg" \
        --execution "$exec_name" --container migrate --tail 50 >&2 || true
      exit 1 ;;
    *) sleep 10 ;;
  esac
done

echo "==> Releasing app (${app})"
az containerapp update -n "$app" -g "$rg" --image "$app_image" -o none

url="https://$(az containerapp show -n "$app" -g "$rg" \
  --query properties.configuration.ingress.fqdn -o tsv)"
echo "==> Deployed ${tag}"
echo "    ${url}"
