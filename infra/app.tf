# Log Analytics backs the Container Apps environment (required). The app and the
# migrate job both run in this environment.
resource "azurerm_log_analytics_workspace" "largo" {
  name                = "log-${var.prefix}"
  resource_group_name = azurerm_resource_group.largo.name
  location            = azurerm_resource_group.largo.location
  sku                 = "PerGB2018"
  retention_in_days   = 30
}

resource "azurerm_container_app_environment" "largo" {
  name                       = "cae-${var.prefix}"
  resource_group_name        = azurerm_resource_group.largo.name
  location                   = azurerm_resource_group.largo.location
  log_analytics_workspace_id = azurerm_log_analytics_workspace.largo.id
  infrastructure_subnet_id   = azurerm_subnet.aca.id

  # Default Consumption workload profile. Required form for a VNet-integrated
  # environment; keeps scale-to-zero.
  workload_profile {
    name                  = "Consumption"
    workload_profile_type = "Consumption"
  }
}

locals {
  # Server FQDN resolves to the private IP inside the VNet via the linked zone.
  # TLS is enforced, so sslmode=require.
  database_url = format(
    "postgres://%s:%s@%s:5432/%s?sslmode=require",
    var.postgres_admin_login,
    random_password.postgres.result,
    azurerm_postgresql_flexible_server.largo.fqdn,
    azurerm_postgresql_flexible_server_database.largo.name,
  )

  # Placeholder image used at first create; real images are pushed later and the
  # app's image is updated out of band (ignore_changes below).
  placeholder_image = "mcr.microsoft.com/k8se/quickstart:latest"
}

resource "azurerm_container_app" "largo" {
  name                         = var.prefix
  container_app_environment_id = azurerm_container_app_environment.largo.id
  resource_group_name          = azurerm_resource_group.largo.name
  revision_mode                = "Single"
  workload_profile_name        = "Consumption"

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.largo.id]
  }

  registry {
    server   = azurerm_container_registry.largo.login_server
    identity = azurerm_user_assigned_identity.largo.id
  }

  secret {
    name  = "database-url"
    value = local.database_url
  }

  ingress {
    external_enabled = true
    target_port      = 3000
    transport        = "auto"

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = var.min_replicas
    max_replicas = 1

    container {
      name   = var.prefix
      image  = local.placeholder_image
      cpu    = 0.5
      memory = "1Gi"

      env {
        name        = "DATABASE_URL"
        secret_name = "database-url"
      }

      # Trust the Container Apps ingress proxy headers so SvelteKit's origin check
      # uses the public host, not the internal one. Avoids a circular dependency
      # on the app's own FQDN.
      env {
        name  = "PROTOCOL_HEADER"
        value = "x-forwarded-proto"
      }
      env {
        name  = "HOST_HEADER"
        value = "x-forwarded-host"
      }
    }
  }

  depends_on = [azurerm_role_assignment.acr_pull]

  lifecycle {
    # The image is managed out of band by `az containerapp update` / deploy.sh.
    ignore_changes = [template[0].container[0].image]
  }
}

# Migrate (and, on first run, seed) job. Manual trigger, tools image.
resource "azurerm_container_app_job" "migrate" {
  name                         = "job-${var.prefix}-migrate"
  resource_group_name          = azurerm_resource_group.largo.name
  location                     = azurerm_resource_group.largo.location
  container_app_environment_id = azurerm_container_app_environment.largo.id
  workload_profile_name        = "Consumption"

  replica_timeout_in_seconds = 1800
  replica_retry_limit        = 1

  manual_trigger_config {
    parallelism              = 1
    replica_completion_count = 1
  }

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.largo.id]
  }

  registry {
    server   = azurerm_container_registry.largo.login_server
    identity = azurerm_user_assigned_identity.largo.id
  }

  secret {
    name  = "database-url"
    value = local.database_url
  }

  template {
    container {
      name   = "migrate"
      image  = local.placeholder_image
      cpu    = 0.5
      memory = "1Gi"

      # Default to applying migrations. Matches the tools image CMD; seeding is a
      # one-time, out-of-band command override.
      command = ["pnpm", "exec", "drizzle-kit", "migrate"]

      env {
        name        = "DATABASE_URL"
        secret_name = "database-url"
      }
    }
  }

  depends_on = [azurerm_role_assignment.acr_pull]

  lifecycle {
    ignore_changes = [template[0].container[0].image]
  }
}
