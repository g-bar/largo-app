resource "random_password" "postgres" {
  length  = 32
  special = true
  # Keep to characters safe in a URL and accepted by Postgres.
  override_special = "-_.~"
}

resource "azurerm_postgresql_flexible_server" "largo" {
  name                = "psql-${var.prefix}"
  resource_group_name = azurerm_resource_group.largo.name
  location            = azurerm_resource_group.largo.location

  version    = "17"
  sku_name   = "GP_Standard_D2s_v3"
  storage_mb = 32768

  backup_retention_days = 7

  administrator_login    = var.postgres_admin_login
  administrator_password = random_password.postgres.result

  # VNet-integrated, no public endpoint. TLS is required by default.
  delegated_subnet_id           = azurerm_subnet.postgres.id
  private_dns_zone_id           = azurerm_private_dns_zone.postgres.id
  public_network_access_enabled = false

  # The private DNS zone link must exist before the server is created.
  depends_on = [azurerm_private_dns_zone_virtual_network_link.postgres]

  lifecycle {
    # Azure may assign/report an availability zone; don't fight it.
    ignore_changes = [zone]
  }
}

resource "azurerm_postgresql_flexible_server_database" "largo" {
  name      = "largo"
  server_id = azurerm_postgresql_flexible_server.largo.id
  collation = "en_US.utf8"
  charset   = "UTF8"
}
