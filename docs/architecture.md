# EnsembleFlow Architecture Notes

## Simple Version

The app is split into two kinds of data:

- **Records**: usernames, ensemble names, sections, assignment status, comments, and file references
- **Files**: photos, logos, and videos

Records belong in DynamoDB because they are small and structured.
Files belong in S3 because they are large binary objects.

## Why This Split Works

- DynamoDB is good for fast lookups and simple app records.
- S3 is cheaper and more appropriate for uploads.
- The browser can upload directly to S3 with a signed URL, which keeps Lambda cheap and avoids moving large files through the API.

## Authentication Path

- Cognito handles sign-in and identity.
- The frontend shows a director portal or a member portal after sign-in.
- An approved email address can open the director portal.
- The frontend uses the signed-in user identity to request API access.
- API Gateway and Lambda enforce the app rules and keep member data scoped to the right ensemble and section.

## Phase 1 Scope

This phase is a scaffold, not a finished product.

Planned next pieces:

- profile storage
- ensemble storage
- upload URLs
- a simple dashboard
- auth wiring

## Product Goal

The app is meant to support a realistic workflow for ensembles:

- secure login
- split director/member dashboards
- user-owned content
- private uploads
- serverless APIs
- infrastructure in Terraform
