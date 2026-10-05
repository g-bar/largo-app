terraform {
  required_version = ">= 1.9"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # State in the existing shared backend, under a new key for this project.
  # Auth is via the signed-in Azure CLI identity (use_azuread_auth), not a key.
  backend "azurerm" {
    resource_group_name  = "rg-tfstate"
    storage_account_name = "tfstategil860623"
    container_name       = "tfstate"
    key                  = "largo-app.tfstate"
    use_azuread_auth     = true
  }
}

provider "azurerm" {
  features {}

  subscription_id = var.subscription_id
  # Authenticate as the signed-in Azure CLI user, not a service principal.
  use_cli = true
}
