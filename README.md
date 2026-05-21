# EnsembleFlow

EnsembleFlow is a web app for music ensembles that helps groups stay organized, keep members accountable, and manage practice activity in one place.

## What The App Is Meant To Do

- Let users create accounts and log in.
- Let users create a profile with a photo.
- Let users create one or more ensembles.
- Let users add sections under each ensemble.
- Let users upload images and videos tied to their account data.
- Later: assignments, submissions, feedback, and progress tracking.

## Planned Stack

- React, Vite, TypeScript
- Cognito
- API Gateway
- Lambda
- DynamoDB
- S3
- Terraform

## Data Flow Summary

- Structured data such as profiles, ensembles, sections, and references to uploads will live in DynamoDB.
- Uploaded files such as profile pictures, logos, and practice videos will live in S3.
- The browser will upload files directly to S3 through signed URLs so large files do not pass through Lambda.

## Repository Layout

- `frontend/` - React app scaffold.
- `terraform/` - AWS infrastructure scaffold.
- `docs/` - architecture notes and implementation reasoning.
- `notes/` - private local-only scratch notes, ignored by git.
- `AGENTS.md` - project memory and working rules.
