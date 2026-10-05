# Largo App: Azure Deployment Plan

## Decisions

- Region: West Europe. Same services as Switzerland North (Container Apps, Postgres 17, B1ms, all unrestricted for this subscription), usually cheaper. Data residency is not a requirement.
- Access: app is public, no login.
- Terraform auth: your own `az login` (Azure CLI auth). The shared `~/code/terraform.env` service principal is not used.
- State: existing backend, new key.
  - Resource group `rg-tfstate`, storage account `tfstategil860623`, container `tfstate`
  - Key `largo-app.tfstate`, `use_azuread_auth = true`
- Terraform code: this gitignored `infra/` folder.
- Dockerfile: repo root, committed, two build targets:
  - `app`: production image
  - `tools`: migrations and seed
- Networking: VNet, private database, NSG on the database subnet only.
- Data: synthetic seed runs once, never needed again.

## Architecture

```
             Internet
                │  HTTPS
                ▼
  ┌──────────── vnet-largo 10.0.0.0/16 ─────────────────┐
  │                                                      │
  │  snet-aca 10.0.0.0/23 (delegated: Microsoft.App)     │
  │  ┌──────────────────────────────┐                    │
  │  │ Container Apps environment   │                    │
  │  │  ├─ largo app   (public URL) │                    │
  │  │  └─ migrate job              │                    │
  │  └──────────────┬───────────────┘                    │
  │                 │ 5432, TLS                          │
  │                 ▼                                    │
  │  snet-postgres 10.0.2.0/24 (delegated: Postgres)     │
  │  ┌──────────────────────────────┐                    │
  │  │ Postgres Flexible Server     │  no public IP      │
  │  └──────────────────────────────┘                    │
  │                                                      │
  │  private DNS zone (linked): server name → 10.0.2.x   │
  └──────────────────────────────────────────────────────┘
                │ outbound (platform-managed)
                ▼
     Container Registry (public endpoint, auth required)
```

Who can reach what:

| From | Reaches | Enforced by |
|---|---|---|
| Internet | App HTTPS only | Only the app has a public IP (load-balancer rule for 80/443). DB has no public endpoint. |
| App, job | DB, registry, internet | Intra-VNet system routes, NSG allow rule. DB also requires password and TLS. Registry requires a token (managed identity with `AcrPull`). |
| Laptop | App, registry, Azure management APIs | No route into the VNet. Private DNS zone only resolves inside the VNet. |
| Other Azure customers | App only | Same as the laptop: outside the VNet. |

## NSG on `snet-postgres`

| Priority | Direction | Source | Port | Action |
|---|---|---|---|---|
| 100 | Inbound | `10.0.0.0/23` (snet-aca) | 5432/TCP | Allow |
| 4000 | Inbound | `VirtualNetwork` | any | Deny |

Defaults stay below. `AllowAzureLoadBalancerInBound` (65001) keeps platform health and management traffic working. `snet-aca` gets no NSG: the Container Apps platform needs specific traffic, and a wrong rule breaks the environment.

## Steps

### 1. One-time setup (you)

```sh
az login   # personal owner account
az account set -s f9e4ee5b-0beb-4649-ac69-bf3189097927

az role assignment create \
  --assignee "$(az ad signed-in-user show --query id -o tsv)" \
  --assignee-principal-type User \
  --role "Storage Blob Data Contributor" \
  --scope "/subscriptions/f9e4ee5b-0beb-4649-ac69-bf3189097927/resourceGroups/rg-tfstate/providers/Microsoft.Storage/storageAccounts/tfstategil860623"
```

- New role assignments can take a few minutes to take effect.
- Do not source `terraform.env` in this shell. If the `ARM_*` variables are set, Terraform logs in as the shared service principal.
- `az login` replaces the current default `az` login, which is the shared service principal.

### 2. Repo changes

- `/infra` in `.gitignore`.
- `Dockerfile` and `.dockerignore` in the repo root:
  - `app` target: `build/`, production dependencies, `node build` on port 3000
  - `tools` target: full dependencies (`drizzle-kit`), `drizzle/`, seed script

### 3. Terraform in `infra/`

- Backend and provider: azurerm backend with the new key, pinned azurerm version, Azure CLI auth.
- Resource group `rg-largo`.
- Network:
  - VNet `vnet-largo`, `10.0.0.0/16`
  - `snet-aca`, `10.0.0.0/23`, delegated to `Microsoft.App/environments`
  - `snet-postgres`, `10.0.2.0/24`, delegated to `Microsoft.DBforPostgreSQL/flexibleServers`
  - NSG on `snet-postgres` (see above)
- Private DNS zone `largo.private.postgres.database.azure.com`, linked to the VNet. The link must exist before the server is created.
- Postgres 17 Flexible Server:
  - `B_Standard_B1ms`, 32 GB, 7-day backups
  - VNet-integrated, no public access, TLS required
  - database `largo`
  - admin password from `random_password`
  - networking mode is fixed at creation
- Container Registry: Basic, admin account off.
- Log Analytics workspace: 30-day retention (required by Container Apps).
- Container Apps environment: workload profiles, Consumption profile, in `snet-aca`, external ingress.
- User-assigned managed identity with `AcrPull` on the registry.
- Container App `largo`:
  - external HTTPS ingress, target port 3000
  - replicas: `var.min_replicas` (default `0`, scale to zero) to 1, 0.5 vCPU, 1 GiB
  - secret `DATABASE_URL`
  - env `PROTOCOL_HEADER=x-forwarded-proto`, `HOST_HEADER=x-forwarded-host` (avoids the `ORIGIN` circular dependency on the app FQDN)
  - placeholder image at creation, `ignore_changes` on the image
- Container Apps Job `job-largo-migrate`: manual trigger, `tools` image, same secret and identity.
- Outputs: app URL, registry name, job name.

### 4. Provision

- `terraform init`, then `terraform plan`. You review the plan before anything is created.
- `terraform apply`.

### 5. Build images

- `az acr build` for the `app` and `tools` targets. Builds run in the cloud for amd64, so nothing cross-compiles on the ARM Mac.

### 6. Migrate and seed

- Job runs `drizzle-kit migrate`, then `db:seed`.
- Start with `az containerapp job start`, confirm success in the logs.
- Afterwards the job runs migrations only.

### 7. Release the app

- `az containerapp update --image` to the real image.
- Steps 5 to 7 wrapped in `infra/deploy.sh` for future releases.

### 8. Verify

- Public URL: list view, a celebrity page (charts, Export, One-Sheet), compare.
- Database has no public endpoint, and its name doesn't resolve from the laptop.

### 9. Before submitting: keep one replica warm

- Set `min_replicas = 1` in `infra/terraform.tfvars` (or `terraform apply -var min_replicas=1`), review the plan, apply.
- Removes cold starts. The idle replica is billed at the lower idle rate.
- Change it through Terraform, not `az containerapp update --min-replicas`. Terraform manages the scale settings, so a CLI change would show up as drift and be reverted on the next apply.

### 10. Teardown

- `terraform destroy` removes all of `rg-largo`. The state backend is untouched.

## Accepted risks

- App is public with no login.
- Registry stays on its public endpoint (private needs Premium plus private endpoints).
- Postgres admin password is stored in Terraform state (blob storage, Entra ID auth).
- Terraform runs with owner rights. Review `terraform plan` before every apply.
- `infra/` is not committed to git.

## Possible later improvements

- Restrict the app with Container Apps ingress IP restrictions or built-in Entra ID login.
- Store the DB password in Key Vault instead of state-managed secrets.
- NAT gateway for a fixed outbound IP, if a downstream service needs to allowlist it.
- One service principal per project if deploys ever run from automation.

## Costs

Main fixed cost is the Postgres server. Container Apps scales to zero when idle. VNet and subnets are free, the private DNS zone is minimal. Check the [Azure pricing calculator](https://azure.microsoft.com/pricing/calculator/) with these SKUs for numbers.
