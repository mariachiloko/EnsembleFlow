locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

resource "aws_dynamodb_table" "users" {
  name         = "${local.name_prefix}-users"
  billing_mode  = "PAY_PER_REQUEST"
  hash_key     = "userId"

  attribute {
    name = "userId"
    type = "S"
  }

  server_side_encryption {
    enabled = true
  }
}

resource "aws_dynamodb_table" "ensembles" {
  name        = "${local.name_prefix}-ensembles"
  billing_mode = "PAY_PER_REQUEST"
  hash_key    = "ensembleId"

  attribute {
    name = "ensembleId"
    type = "S"
  }

  attribute {
    name = "ownerId"
    type = "S"
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

resource "aws_dynamodb_table" "memberships" {
  name         = "${local.name_prefix}-memberships"
  billing_mode  = "PAY_PER_REQUEST"
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
  billing_mode  = "PAY_PER_REQUEST"
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
  billing_mode  = "PAY_PER_REQUEST"
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
  name        = "${local.name_prefix}-assignments"
  billing_mode = "PAY_PER_REQUEST"
  hash_key    = "assignmentId"

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
  name        = "${local.name_prefix}-submissions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key    = "submissionId"

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

  server_side_encryption {
    enabled = true
  }
}
