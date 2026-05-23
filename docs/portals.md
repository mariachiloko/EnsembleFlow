# EnsembleFlow Portals

## Director Portal

The director portal is for approved email addresses only.

It focuses on:

- profile setup with a unique username and photo
- ensemble creation
- join-code sharing
- member approval, removal, and blocking
- assignment creation and review

## Member Portal

The member portal is for regular ensemble members.

It focuses on:

- joining an ensemble with a code
- seeing assigned ensembles
- seeing assignments
- uploading practice videos
- commenting on submissions inside the member's section
- reading updates and feedback

## Why This Split Exists

The same Cognito login handles both portals, but the app shows different dashboards depending on the approved email and the requested sign-in path.

That keeps the application simple while still separating management tools from member work.
