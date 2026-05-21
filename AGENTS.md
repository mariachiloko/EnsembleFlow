# EnsembleFlow AGENTS

## Current Phase

Phase 11: authenticated workspace and ensemble approval flow.

## Project Standards

- Keep the codebase simple enough to explain in interviews.
- Prefer readable, explicit code over clever abstractions.
- Build in small phases and document each step.
- Treat every scaffolded file as intentional, not placeholder noise.

## Architecture Decisions

- Frontend: React + Vite + TypeScript.
- Backend: AWS serverless.
- Authentication: Cognito.
- API layer: API Gateway + Lambda.
- Data: DynamoDB for structured records.
- File storage: S3 for uploads such as profile photos, logos, and videos.
- Infrastructure: Terraform.

## Security Rules

- Never commit secrets, credentials, or state files.
- Do not hardcode AWS values that should stay environment-specific.
- Keep user uploads private unless a feature explicitly requires sharing.
- Keep `notes/` out of git so private working memory stays local.

## Conventions

- Use `README.md` for public-facing project explanation.
- Use `docs/` for technical architecture and reasoning.
- Use `notes/` for private session memory, tradeoffs, and issue logs.
- Keep Terraform readable and minimally abstracted.

## What Has Been Completed

- Initialized the repository.
- Renamed the default branch to `main`.
- Added the public docs: `README.md` and `docs/architecture.md`.
- Added the private worklog in `notes/`.
- Added the frontend scaffold.
- Added the Terraform scaffold.
- Defined the first product data model in docs.
- Added Terraform resources for Cognito, DynamoDB, S3, Lambda, and API Gateway.
- Initialized Terraform and generated the lock file.
- Added a dashboard-style frontend shell with backend health awareness.
- Added real profile, ensemble, and upload handler logic.
- Added form-based frontend workflows that can use a Cognito token.
- Added Cognito Hosted UI settings and a PKCE sign-in flow.
- Added auth-aware frontend controls and session persistence.
- Added assignment, submission, and feedback workflows.
- Added section and membership management.
- Added role-aware director/member workspace behavior.
- Added submission comments and in-app notifications.
- Added demo content scaffolding for preview mode.
- Added deployment notes that call out when AWS credentials are needed.
- Deployed the live AWS dev stack with Terraform and verified the API health route.
- Wired the frontend to the live Cognito and API outputs in a local-only env file.
- Added a sign-in-first app gate so the workspace is hidden until a user is authenticated.
- Added ensemble code requests, director approval, co-director access, and member removal flows.

## What Still Needs To Happen

- Tighten refresh-token and session-expiry handling if needed.
- Decide whether to keep or replace the local-only live env file before wider sharing.
- Decide whether to add a Google identity provider later, if a second login option is still desired.
