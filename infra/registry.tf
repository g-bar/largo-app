resource "azurerm_container_registry" "largo" {
  name                = "acr${var.prefix}${random_string.acr_suffix.result}"
  resource_group_name = azurerm_resource_group.largo.name
  location            = azurerm_resource_group.largo.location
  sku                 = "Basic"
  admin_enabled       = false
}

# ACR names are globally unique and alphanumeric only; add a short random suffix.
resource "random_string" "acr_suffix" {
  length  = 6
  special = false
  upper   = false
}

# User-assigned identity the app and job use to pull from the registry.
resource "azurerm_user_assigned_identity" "largo" {
  name                = "id-${var.prefix}"
  resource_group_name = azurerm_resource_group.largo.name
  location            = azurerm_resource_group.largo.location
}

resource "azurerm_role_assignment" "acr_pull" {
  scope                = azurerm_container_registry.largo.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.largo.principal_id
}
