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

