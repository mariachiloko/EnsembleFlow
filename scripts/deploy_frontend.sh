#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TERRAFORM_DIR="${ROOT_DIR}/terraform"
FRONTEND_DIR="${ROOT_DIR}/frontend"

API_URL="$(terraform -chdir="${TERRAFORM_DIR}" output -raw api_url)"
COGNITO_DOMAIN="$(terraform -chdir="${TERRAFORM_DIR}" output -raw hosted_ui_domain)"
COGNITO_CLIENT_ID="$(terraform -chdir="${TERRAFORM_DIR}" output -raw user_pool_client_id)"
FRONTEND_URL="$(terraform -chdir="${TERRAFORM_DIR}" output -raw frontend_url)"
FRONTEND_BUCKET="$(terraform -chdir="${TERRAFORM_DIR}" output -raw frontend_bucket_name)"
DISTRIBUTION_ID="$(terraform -chdir="${TERRAFORM_DIR}" output -raw frontend_distribution_id)"

cat > "${FRONTEND_DIR}/.env.production.local" <<EOF
VITE_API_URL=${API_URL}
VITE_COGNITO_DOMAIN=${COGNITO_DOMAIN}
VITE_COGNITO_CLIENT_ID=${COGNITO_CLIENT_ID}
VITE_COGNITO_REDIRECT_URI=${FRONTEND_URL}
VITE_COGNITO_LOGOUT_URI=${FRONTEND_URL}
VITE_COGNITO_SCOPES=openid email profile
EOF

npm --prefix "${FRONTEND_DIR}" run build

aws s3 sync "${FRONTEND_DIR}/dist" "s3://${FRONTEND_BUCKET}" \
  --delete \
  --cache-control "public,max-age=300"

aws cloudfront create-invalidation \
  --distribution-id "${DISTRIBUTION_ID}" \
  --paths "/*" >/dev/null

echo "Frontend deployed: ${FRONTEND_URL}"
