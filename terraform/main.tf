module "auth" {
  source = "./modules/auth"

  project_name  = var.project_name
  environment   = var.environment
  aws_region    = var.aws_region
  domain_prefix = var.cognito_domain_prefix
  callback_urls = var.oauth_callback_urls
  logout_urls   = var.oauth_logout_urls
}

module "database" {
  source = "./modules/database"

  project_name = var.project_name
  environment  = var.environment
}

module "storage" {
  source = "./modules/storage"

  project_name            = var.project_name
  environment             = var.environment
  allowed_origins         = concat([var.web_app_origin], var.additional_web_origins)
  enable_versioning       = true
  enable_server_side_logs = false
}

module "api" {
  source = "./modules/api"

  project_name           = var.project_name
  environment            = var.environment
  aws_region             = var.aws_region
  allowed_origin         = var.web_app_origin
  user_pool_id           = module.auth.user_pool_id
  user_pool_client_id    = module.auth.user_pool_client_id
  users_table_name       = module.database.users_table_name
  ensembles_table_name   = module.database.ensembles_table_name
  memberships_table_name = module.database.memberships_table_name
  sections_table_name    = module.database.sections_table_name
  uploads_table_name     = module.database.uploads_table_name
  assignments_table_name = module.database.assignments_table_name
  submissions_table_name = module.database.submissions_table_name
  uploads_bucket_name    = module.storage.bucket_name
}
