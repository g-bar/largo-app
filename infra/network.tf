resource "azurerm_resource_group" "largo" {
  name     = "rg-${var.prefix}"
  location = var.location
}

resource "azurerm_virtual_network" "largo" {
  name                = "vnet-${var.prefix}"
  resource_group_name = azurerm_resource_group.largo.name
  location            = azurerm_resource_group.largo.location
  address_space       = ["10.0.0.0/16"]
}

# Container Apps subnet. Delegated to Microsoft.App/environments.
# No NSG: the Container Apps platform needs specific traffic and a wrong rule
# breaks the environment.
resource "azurerm_subnet" "aca" {
  name                 = "snet-aca"
  resource_group_name  = azurerm_resource_group.largo.name
  virtual_network_name = azurerm_virtual_network.largo.name
  address_prefixes     = ["10.0.0.0/23"]

  delegation {
    name = "aca"
    service_delegation {
      name    = "Microsoft.App/environments"
      actions = ["Microsoft.Network/virtualNetworks/subnets/join/action"]
    }
  }
}

# Postgres subnet. Delegated to the Flexible Server service.
resource "azurerm_subnet" "postgres" {
  name                 = "snet-postgres"
  resource_group_name  = azurerm_resource_group.largo.name
  virtual_network_name = azurerm_virtual_network.largo.name
  address_prefixes     = ["10.0.2.0/24"]

  delegation {
    name = "postgres"
    service_delegation {
      name = "Microsoft.DBforPostgreSQL/flexibleServers"
      actions = [
        "Microsoft.Network/virtualNetworks/subnets/join/action",
      ]
    }
  }

  lifecycle {
    # The Flexible Server delegation adds a Microsoft.Storage service endpoint to
    # this subnet for its backing storage. It's platform-managed, so don't fight it.
    ignore_changes = [service_endpoints]
  }
}

resource "azurerm_network_security_group" "postgres" {
  name                = "nsg-snet-postgres"
  resource_group_name = azurerm_resource_group.largo.name
  location            = azurerm_resource_group.largo.location

  # Allow Postgres from the Container Apps subnet only.
  security_rule {
    name                       = "allow-aca-5432"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "5432"
    source_address_prefix      = "10.0.0.0/23"
    destination_address_prefix = "*"
  }

  # Deny everything else from inside the VNet. Platform defaults below
  # (AllowAzureLoadBalancerInBound at 65001) keep health/management traffic working.
  security_rule {
    name                       = "deny-vnet-inbound"
    priority                   = 4000
    direction                  = "Inbound"
    access                     = "Deny"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "VirtualNetwork"
    destination_address_prefix = "*"
  }
}

resource "azurerm_subnet_network_security_group_association" "postgres" {
  subnet_id                 = azurerm_subnet.postgres.id
  network_security_group_id = azurerm_network_security_group.postgres.id
}

# Private DNS zone for the Flexible Server. The VNet link must exist before the
# server is created, hence the explicit depends_on on the server.
resource "azurerm_private_dns_zone" "postgres" {
  name                = "${var.prefix}.private.postgres.database.azure.com"
  resource_group_name = azurerm_resource_group.largo.name
}

resource "azurerm_private_dns_zone_virtual_network_link" "postgres" {
  name                  = "${var.prefix}-postgres-link"
  resource_group_name   = azurerm_resource_group.largo.name
  private_dns_zone_name = azurerm_private_dns_zone.postgres.name
  virtual_network_id    = azurerm_virtual_network.largo.id
}
