output "api_url" {
  value       = aws_apigatewayv2_api.this.api_endpoint
  description = "Base URL for the HTTP API."
}

