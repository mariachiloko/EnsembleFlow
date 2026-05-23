variable "project_name" {
  description = "Name used to prefix AWS resources."
  type        = string
  default     = "ensembleflow"
}

variable "environment" {
  description = "Deployment environment name."
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "AWS region for the scaffold."
  type        = string
  default     = "us-east-1"
}

variable "web_app_origin" {
  description = "Primary browser origin for the app."
  type        = string
  default     = "http://localhost:5173"
}

variable "additional_web_origins" {
  description = "Additional browser origins that should be allowed to call the app and upload APIs."
  type        = list(string)
  default     = []
}

variable "cognito_domain_prefix" {
  description = "Cognito hosted UI domain prefix."
  type        = string
  default     = "ensembleflow-dev"
}

variable "oauth_callback_urls" {
  description = "Allowed OAuth callback URLs for Cognito."
  type        = list(string)
  default     = ["http://localhost:5173"]
}

variable "oauth_logout_urls" {
  description = "Allowed OAuth logout URLs for Cognito."
  type        = list(string)
  default     = ["http://localhost:5173"]
}

variable "director_email_allowlist" {
  description = "Email addresses allowed to use the director dashboard."
  type        = list(string)
  default     = []
}
