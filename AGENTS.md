# EnsembleFlow AGENTS

## Current Phase

Phase 3: frontend wiring and product shell.

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

## What Still Needs To Happen

- Add the first real profile and ensemble CRUD handlers.
- Add upload URL generation.
- Wire the frontend to the upload flow.
- Add the first implementation phase for assignments and submissions.
- Wire the frontend to Cognito and the real backend routes.
