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

output "sections_table_name" {
  value       = aws_dynamodb_table.sections.name
  description = "DynamoDB table for ensemble sections."
}

output "uploads_table_name" {
  value       = aws_dynamodb_table.uploads.name
  description = "DynamoDB table for upload metadata."
}

output "assignments_table_name" {
  value       = aws_dynamodb_table.assignments.name
  description = "DynamoDB table for assignments."
}

output "submissions_table_name" {
  value       = aws_dynamodb_table.submissions.name
  description = "DynamoDB table for submissions."
}
