output "user_pool_id" {
  value       = aws_cognito_user_pool.this.id
  description = "Cognito user pool ID."
}

output "user_pool_arn" {
  value       = aws_cognito_user_pool.this.arn
  description = "Cognito user pool ARN."
}

output "user_pool_client_id" {
  value       = aws_cognito_user_pool_client.this.id
  description = "Cognito user pool app client ID."
}

output "hosted_ui_domain" {
  value       = "https://${aws_cognito_user_pool_domain.this.domain}.auth.${var.aws_region}.amazoncognito.com"
  description = "Cognito hosted UI base URL."
}
