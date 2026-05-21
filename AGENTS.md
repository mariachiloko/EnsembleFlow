# EnsembleFlow AGENTS

## Current Phase

Phase 1: repository foundation and scaffold.

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

## What Still Needs To Happen

- Add AWS resources for auth, API, data, and uploads.
- Wire the frontend to real backend endpoints.
- Document the storage and upload flow in plain language.
- Add the first implementation phase for auth, profiles, and ensemble data.
