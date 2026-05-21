# Terraform Scaffold

This directory will hold the AWS infrastructure for EnsembleFlow.

## Planned Layout

- root Terraform files for shared configuration
- module folders for auth, API, storage, and data
- environment-specific values outside of git

## Phase 1 Status

This is only a scaffold. The real AWS resources will be added in the next phase.

## Design Notes

- Keep the configuration readable.
- Avoid unnecessary abstraction.
- Use Terraform to describe the real AWS resources once the app shape is stable.
- Keep state out of git.

