output "bucket_name" {
  value       = aws_s3_bucket.this.bucket
  description = "Uploads bucket name."
}

output "bucket_arn" {
  value       = aws_s3_bucket.this.arn
  description = "Uploads bucket ARN."
}

