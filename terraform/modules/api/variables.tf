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
  description = "AWS region for deployed resources."
}

variable "allowed_origin" {
  type        = string
  description = "Primary browser origin allowed by CORS."
}

variable "user_pool_id" {
  type        = string
  description = "Cognito user pool ID."
}

variable "user_pool_client_id" {
  type        = string
  description = "Cognito app client ID."
}

variable "users_table_name" {
  type        = string
  description = "DynamoDB table for users."
}

variable "ensembles_table_name" {
  type        = string
  description = "DynamoDB table for ensembles."
}

variable "memberships_table_name" {
  type        = string
  description = "DynamoDB table for memberships."
}

variable "uploads_table_name" {
  type        = string
  description = "DynamoDB table for uploads."
}

variable "assignments_table_name" {
  type        = string
  description = "DynamoDB table for assignments."
}

variable "submissions_table_name" {
  type        = string
  description = "DynamoDB table for submissions."
}

variable "uploads_bucket_name" {
  type        = string
  description = "S3 bucket used for uploads."
}
