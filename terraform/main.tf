module "frontend" {
  source = "./modules/frontend"

  project_name = var.project_name
  environment  = var.environment
}

module "auth" {
  source = "./modules/auth"

  project_name  = var.project_name
  environment   = var.environment
  aws_region    = var.aws_region
  domain_prefix = var.cognito_domain_prefix
  callback_urls = distinct(concat(var.oauth_callback_urls, [module.frontend.site_url]))
  logout_urls   = distinct(concat(var.oauth_logout_urls, [module.frontend.site_url]))
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
  allowed_origins         = distinct(concat([var.web_app_origin, module.frontend.site_url], var.additional_web_origins))
  enable_versioning       = true
  enable_server_side_logs = false
}

module "api" {
  source = "./modules/api"

  project_name                     = var.project_name
  environment                      = var.environment
  aws_region                       = var.aws_region
  allowed_origins                  = distinct(concat([var.web_app_origin, module.frontend.site_url], var.additional_web_origins))
  director_email_allowlist         = var.director_email_allowlist
  user_pool_id                     = module.auth.user_pool_id
  user_pool_client_id              = module.auth.user_pool_client_id
  users_table_name                 = module.database.users_table_name
  usernames_table_name             = module.database.usernames_table_name
  ensembles_table_name             = module.database.ensembles_table_name
  memberships_table_name           = module.database.memberships_table_name
  sections_table_name              = module.database.sections_table_name
  uploads_table_name               = module.database.uploads_table_name
  assignments_table_name           = module.database.assignments_table_name
  submissions_table_name           = module.database.submissions_table_name
  comments_table_name              = module.database.comments_table_name
  conversations_table_name         = module.database.conversations_table_name
  conversation_messages_table_name = module.database.conversation_messages_table_name
  invitations_table_name           = module.database.invitations_table_name
  notifications_table_name         = module.database.notifications_table_name
  uploads_bucket_name              = module.storage.bucket_name
}
