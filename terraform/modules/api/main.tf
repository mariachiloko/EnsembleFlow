locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

data "archive_file" "handler_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../functions/api"
  output_path = "${path.module}/api-handler.zip"
}

data "aws_caller_identity" "current" {}

resource "aws_iam_role" "lambda" {
  name = "${local.name_prefix}-api-lambda"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambda" {
  name = "${local.name_prefix}-api-lambda"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:Scan",
        ]
        Resource = [
          "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.users_table_name}",
          "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.ensembles_table_name}",
          "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.memberships_table_name}",
          "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.sections_table_name}",
          "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.uploads_table_name}",
          "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.assignments_table_name}",
          "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.submissions_table_name}",
          "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.comments_table_name}",
          "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.invitations_table_name}",
          "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.notifications_table_name}",
          "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.users_table_name}/index/*",
          "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.ensembles_table_name}/index/*",
          "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.memberships_table_name}/index/*",
          "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.sections_table_name}/index/*",
          "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.uploads_table_name}/index/*",
          "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.assignments_table_name}/index/*",
          "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.submissions_table_name}/index/*",
          "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.comments_table_name}/index/*",
          "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.invitations_table_name}/index/*",
          "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.notifications_table_name}/index/*",
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
        ]
        Resource = [
          "arn:aws:s3:::${var.uploads_bucket_name}",
          "arn:aws:s3:::${var.uploads_bucket_name}/*",
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_lambda_function" "this" {
  function_name = "${local.name_prefix}-api"
  role          = aws_iam_role.lambda.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  filename      = data.archive_file.handler_zip.output_path
  source_code_hash = data.archive_file.handler_zip.output_base64sha256
  timeout       = 10
  memory_size   = 128

  environment {
    variables = {
      USERS_TABLE_NAME       = var.users_table_name
      ENSEMBLES_TABLE_NAME    = var.ensembles_table_name
      MEMBERSHIPS_TABLE_NAME  = var.memberships_table_name
      SECTIONS_TABLE_NAME     = var.sections_table_name
      UPLOADS_TABLE_NAME      = var.uploads_table_name
      ASSIGNMENTS_TABLE_NAME  = var.assignments_table_name
      SUBMISSIONS_TABLE_NAME  = var.submissions_table_name
      COMMENTS_TABLE_NAME     = var.comments_table_name
      INVITATIONS_TABLE_NAME  = var.invitations_table_name
      NOTIFICATIONS_TABLE_NAME = var.notifications_table_name
      UPLOADS_BUCKET_NAME     = var.uploads_bucket_name
    }
  }
}

resource "aws_cloudwatch_log_group" "this" {
  name              = "/aws/lambda/${aws_lambda_function.this.function_name}"
  retention_in_days = 14
}

resource "aws_apigatewayv2_api" "this" {
  name          = "${local.name_prefix}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_credentials = false
    allow_headers     = ["authorization", "content-type"]
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_origins     = [var.allowed_origin]
    max_age           = 3600
  }
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.this.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.this.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_authorizer" "jwt" {
  api_id          = aws_apigatewayv2_api.this.id
  name            = "${local.name_prefix}-jwt"
  authorizer_type = "JWT"
  identity_sources = ["$request.header.Authorization"]

  jwt_configuration {
    audience = [var.user_pool_client_id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${var.user_pool_id}"
  }
}

resource "aws_apigatewayv2_route" "health" {
  api_id    = aws_apigatewayv2_api.this.id
  route_key = "GET /health"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

locals {
  protected_routes = {
    "GET /profiles" = {}
    "POST /profiles" = {}
    "GET /profiles/{userId}" = {}
    "PUT /profiles/{userId}" = {}
    "GET /ensembles" = {}
    "POST /ensembles" = {}
    "GET /ensembles/{ensembleId}" = {}
    "PUT /ensembles/{ensembleId}" = {}
    "POST /uploads/presign" = {}
    "GET /sections" = {}
    "POST /sections" = {}
    "GET /sections/{sectionId}" = {}
    "PUT /sections/{sectionId}" = {}
    "GET /memberships" = {}
    "POST /memberships" = {}
    "GET /memberships/{userId}/{ensembleId}" = {}
    "PUT /memberships/{userId}/{ensembleId}" = {}
    "GET /assignments" = {}
    "POST /assignments" = {}
    "GET /assignments/{assignmentId}" = {}
    "PUT /assignments/{assignmentId}" = {}
    "GET /submissions" = {}
    "POST /submissions" = {}
    "GET /submissions/{submissionId}" = {}
    "PUT /submissions/{submissionId}" = {}
    "GET /comments" = {}
    "POST /comments" = {}
    "GET /invitations" = {}
    "POST /invitations" = {}
    "POST /invitations/accept" = {}
    "GET /notifications" = {}
    "PUT /notifications/{notificationId}" = {}
  }
}

resource "aws_apigatewayv2_route" "protected" {
  for_each = local.protected_routes

  api_id             = aws_apigatewayv2_api.this.id
  route_key          = each.key
  target             = "integrations/${aws_apigatewayv2_integration.lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

resource "aws_apigatewayv2_stage" "this" {
  api_id      = aws_apigatewayv2_api.this.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "api" {
  statement_id  = "AllowInvokeFromApiGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.this.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.this.execution_arn}/*/*"
}
