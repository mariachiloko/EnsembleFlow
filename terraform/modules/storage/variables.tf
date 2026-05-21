variable "project_name" {
  type        = string
  description = "Project name used in resource naming."
}

variable "environment" {
  type        = string
  description = "Deployment environment."
}

variable "allowed_origins" {
  type        = list(string)
  description = "Allowed browser origins for direct upload requests."
}

variable "enable_versioning" {
  type        = bool
  description = "Whether to enable object versioning."
  default     = true
}

variable "enable_server_side_logs" {
  type        = bool
  description = "Reserved for future access logging configuration."
  default     = false
}

