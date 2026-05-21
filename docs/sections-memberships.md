# EnsembleFlow Sections and Memberships

## Core Idea

Sections keep each ensemble organized by instrument family or subgroup.
Memberships connect a person to an ensemble and can point to the section they belong to.

## What This Supports

- multiple ensembles per account
- multiple sections per ensemble
- member roles such as director, leader, and member
- section assignment inside each ensemble

## Storage Shape

- Sections live in DynamoDB so the app can list and update them quickly.
- Memberships live in DynamoDB so the app can track who belongs where.
- The UI can group sections by ensemble and show membership on the workspace.

## Current Scope

This phase adds the ability to:

- create sections
- list sections for an ensemble
- create memberships
- list memberships for an ensemble

Invitation flows and automated member provisioning are not included yet.
