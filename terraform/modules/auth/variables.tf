variable "project_name" {
  type        = string
  description = "Project name used in resource naming."
}

variable "environment" {
  type        = string
  description = "Deployment environment."
}

variable "aws_region" {
  type        = string
  description = "AWS region for Cognito hosted UI URLs."
}

variable "domain_prefix" {
  type        = string
  description = "Hosted UI domain prefix."
}

variable "callback_urls" {
  type        = list(string)
  description = "Allowed OAuth callback URLs."
}

variable "logout_urls" {
  type        = list(string)
  description = "Allowed OAuth logout URLs."
}
