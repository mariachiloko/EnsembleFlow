locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

resource "aws_dynamodb_table" "users" {
  name         = "${local.name_prefix}-users"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"

  attribute {
    name = "userId"
    type = "S"
  }

  server_side_encryption {
    enabled = true
  }
}

resource "aws_dynamodb_table" "usernames" {
  name         = "${local.name_prefix}-usernames"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "username"

  attribute {
    name = "username"
    type = "S"
  }

  server_side_encryption {
    enabled = true
  }
}

resource "aws_dynamodb_table" "ensembles" {
  name         = "${local.name_prefix}-ensembles"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "ensembleId"

  attribute {
    name = "ensembleId"
    type = "S"
  }

  attribute {
    name = "ownerId"
    type = "S"
  }

  attribute {
    name = "accessCode"
    type = "S"
  }

  global_secondary_index {
    name            = "ownerId-index"
    hash_key        = "ownerId"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "accessCode-index"
    hash_key        = "accessCode"
    projection_type = "ALL"
  }

  server_side_encryption {
    enabled = true
  }
}

resource "aws_dynamodb_table" "memberships" {
  name         = "${local.name_prefix}-memberships"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"
  range_key    = "ensembleId"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "ensembleId"
    type = "S"
  }

  global_secondary_index {
    name            = "ensembleId-index"
    hash_key        = "ensembleId"
    projection_type = "ALL"
  }

  server_side_encryption {
    enabled = true
  }
}

resource "aws_dynamodb_table" "sections" {
  name         = "${local.name_prefix}-sections"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "sectionId"

  attribute {
    name = "sectionId"
    type = "S"
  }

  attribute {
    name = "ensembleId"
    type = "S"
  }

  attribute {
    name = "ownerId"
    type = "S"
  }

  global_secondary_index {
    name            = "ensembleId-index"
    hash_key        = "ensembleId"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "ownerId-index"
    hash_key        = "ownerId"
    projection_type = "ALL"
  }

  server_side_encryption {
    enabled = true
  }
}

resource "aws_dynamodb_table" "uploads" {
  name         = "${local.name_prefix}-uploads"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "uploadId"

  attribute {
    name = "uploadId"
    type = "S"
  }

  attribute {
    name = "ownerId"
    type = "S"
  }

  attribute {
    name = "ensembleId"
    type = "S"
  }

  global_secondary_index {
    name            = "ownerId-index"
    hash_key        = "ownerId"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "ensembleId-index"
    hash_key        = "ensembleId"
    projection_type = "ALL"
  }

  server_side_encryption {
    enabled = true
  }
}

resource "aws_dynamodb_table" "assignments" {
  name         = "${local.name_prefix}-assignments"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "assignmentId"

  attribute {
    name = "assignmentId"
    type = "S"
  }

  attribute {
    name = "ownerId"
    type = "S"
  }

  attribute {
    name = "ensembleId"
    type = "S"
  }

  global_secondary_index {
    name            = "ownerId-index"
    hash_key        = "ownerId"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "ensembleId-index"
    hash_key        = "ensembleId"
    projection_type = "ALL"
  }

  server_side_encryption {
    enabled = true
  }
}

resource "aws_dynamodb_table" "submissions" {
  name         = "${local.name_prefix}-submissions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "submissionId"

  attribute {
    name = "submissionId"
    type = "S"
  }

  attribute {
    name = "assignmentId"
    type = "S"
  }

  attribute {
    name = "ownerId"
    type = "S"
  }

  attribute {
    name = "sectionId"
    type = "S"
  }

  attribute {
    name = "ensembleId"
    type = "S"
  }

  global_secondary_index {
    name            = "assignmentId-index"
    hash_key        = "assignmentId"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "ownerId-index"
    hash_key        = "ownerId"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "sectionId-index"
    hash_key        = "sectionId"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "ensembleId-index"
    hash_key        = "ensembleId"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  server_side_encryption {
    enabled = true
  }
}

resource "aws_dynamodb_table" "comments" {
  name         = "${local.name_prefix}-comments"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "submissionId"
  range_key    = "commentId"

  attribute {
    name = "submissionId"
    type = "S"
  }

  attribute {
    name = "commentId"
    type = "S"
  }

  server_side_encryption {
    enabled = true
  }
}

resource "aws_dynamodb_table" "conversations" {
  name         = "${local.name_prefix}-conversations"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "conversationId"

  attribute {
    name = "conversationId"
    type = "S"
  }

  attribute {
    name = "ensembleId"
    type = "S"
  }

  attribute {
    name = "sectionId"
    type = "S"
  }

  global_secondary_index {
    name            = "ensembleId-index"
    hash_key        = "ensembleId"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "sectionId-index"
    hash_key        = "sectionId"
    projection_type = "ALL"
  }

  server_side_encryption {
    enabled = true
  }
}

resource "aws_dynamodb_table" "conversation_messages" {
  name         = "${local.name_prefix}-conversation-messages"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "conversationId"
  range_key    = "messageId"

  attribute {
    name = "conversationId"
    type = "S"
  }

  attribute {
    name = "messageId"
    type = "S"
  }

  server_side_encryption {
    enabled = true
  }
}

resource "aws_dynamodb_table" "invitations" {
  name         = "${local.name_prefix}-invitations"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "inviteCode"

  attribute {
    name = "inviteCode"
    type = "S"
  }

  attribute {
    name = "ensembleId"
    type = "S"
  }

  global_secondary_index {
    name            = "ensembleId-index"
    hash_key        = "ensembleId"
    projection_type = "ALL"
  }

  server_side_encryption {
    enabled = true
  }
}

resource "aws_dynamodb_table" "notifications" {
  name         = "${local.name_prefix}-notifications"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"
  range_key    = "notificationId"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "notificationId"
    type = "S"
  }

  server_side_encryption {
    enabled = true
  }
}
