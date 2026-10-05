variable "subscription_id" {
  type        = string
  description = "Target Azure subscription."
  default     = "f9e4ee5b-0beb-4649-ac69-bf3189097927"
}

variable "location" {
  type        = string
  description = "Azure region."
  default     = "westeurope"
}

variable "prefix" {
  type        = string
  description = "Name prefix for resources."
  default     = "largo"
}

variable "postgres_admin_login" {
  type        = string
  description = "Postgres administrator login."
  default     = "largoadmin"
}

variable "min_replicas" {
  type        = number
  description = "Minimum replicas for the app. 0 scales to zero (cold starts); 1 keeps one warm."
  default     = 0
}
