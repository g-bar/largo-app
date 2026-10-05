output "app_url" {
  description = "Public HTTPS URL of the app."
  value       = "https://${azurerm_container_app.largo.ingress[0].fqdn}"
}

output "registry_name" {
  description = "Container registry name (for az acr build)."
  value       = azurerm_container_registry.largo.name
}

output "registry_login_server" {
  description = "Container registry login server."
  value       = azurerm_container_registry.largo.login_server
}

output "migrate_job_name" {
  description = "Container Apps job name for migrations/seed."
  value       = azurerm_container_app_job.migrate.name
}

output "container_app_name" {
  description = "Container App name (for az containerapp update)."
  value       = azurerm_container_app.largo.name
}

output "resource_group" {
  description = "Resource group holding all app infrastructure."
  value       = azurerm_resource_group.largo.name
}
