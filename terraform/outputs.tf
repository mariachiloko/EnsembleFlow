output "api_url" {
  description = "Base URL for the HTTP API."
  value       = module.api.api_url
}

output "user_pool_id" {
  description = "Cognito user pool ID."
  value       = module.auth.user_pool_id
}

output "user_pool_client_id" {
  description = "Cognito app client ID."
  value       = module.auth.user_pool_client_id
}

output "hosted_ui_domain" {
  description = "Cognito hosted UI base URL."
  value       = module.auth.hosted_ui_domain
}

output "uploads_bucket_name" {
  description = "S3 bucket used for uploads."
  value       = module.storage.bucket_name
}
