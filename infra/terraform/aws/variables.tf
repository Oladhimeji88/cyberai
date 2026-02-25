variable "region" {
  type    = string
  default = "us-east-1"
}

variable "trusted_principal_arn" {
  type        = string
  description = "AWS principal allowed to assume this role (the backend execution identity)."
}

variable "external_id" {
  type        = string
  description = "External ID that backend must provide when assuming role."
}

variable "enable_rotation_role" {
  type    = bool
  default = false
}

variable "rotation_user_name" {
  type    = string
  default = "demo-rotation-user"
}