output "users_table_name" {
  value       = aws_dynamodb_table.users.name
  description = "DynamoDB table for user profiles."
}

output "ensembles_table_name" {
  value       = aws_dynamodb_table.ensembles.name
  description = "DynamoDB table for ensembles."
}

output "memberships_table_name" {
  value       = aws_dynamodb_table.memberships.name
  description = "DynamoDB table for ensemble memberships."
}

output "uploads_table_name" {
  value       = aws_dynamodb_table.uploads.name
  description = "DynamoDB table for upload metadata."
}

