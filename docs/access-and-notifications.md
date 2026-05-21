# EnsembleFlow Access and Notifications

## Access Model

The app uses a single workspace with role-aware navigation.

- Directors and section leaders can access the management tools.
- Members focus on their section feed, comments, and notifications.

## How Access Works

- An ensemble owner acts like the director for that ensemble.
- Membership records connect users to a section and role.
- The app uses that membership data to decide what to show.

## Section Feed

- Members can view submissions from their section.
- Directors can view the full ensemble feed.
- Each submission keeps its `sectionId` so the feed can stay scoped correctly.

## Comments

- Comments are stored on the submission thread.
- Members can comment on the submissions they can see.
- Directors can comment across the ensemble.

## Notifications

- New submissions create in-app notifications.
- New comments create in-app notifications.
- Review feedback creates in-app notifications.

Notifications stay in DynamoDB so the feature is cheap and simple to operate.
