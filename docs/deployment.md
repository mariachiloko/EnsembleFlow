# EnsembleFlow Deployment

## Local Setup

The repository is built so the frontend and Terraform configuration can be prepared locally before any AWS resources are created.

## When AWS Access Is Needed

AWS credentials are only needed when you run Terraform against a real account.

That means the first required AWS-authenticated step is:

- `terraform plan`
- `terraform apply`

At that point, use an AWS profile or another configured credential source for the account that will host the stack.

## What Gets Deployed

- Cognito user pool and app client
- API Gateway HTTP API
- Lambda handler
- DynamoDB tables
- private S3 bucket for uploads
- API permissions and routes
- email-based sign-in and email recovery in Cognito

## After Deployment

- copy the Terraform outputs into the frontend environment variables
- configure the Cognito hosted UI URLs in the browser app
- test sign-in, profile updates, uploads, assignments, and section feeds

## Current Live Stack

The development stack is deployed in the configured AWS account and the live API health check is reachable.

Current Terraform outputs:
- API Gateway URL
- Cognito user pool ID
- Cognito app client ID
- Cognito hosted UI domain
- private uploads bucket name

## Notes

- The stack is intentionally simple and single-account.
- No GitHub Actions or automated deploy pipeline is required for the first live deployment.
