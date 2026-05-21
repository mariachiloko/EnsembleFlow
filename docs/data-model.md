# EnsembleFlow Data Model

## Core Records

### User Profile

Stores the account holder's profile details.

Typical fields:

- `userId`
- `email`
- `displayName`
- `photoKey`
- `createdAt`
- `updatedAt`

### Ensemble

Stores one group that a user manages or belongs to.

Typical fields:

- `ensembleId`
- `ownerId`
- `name`
- `logoKey`
- `description`
- `createdAt`
- `updatedAt`

### Membership

Connects a user to an ensemble.

Typical fields:

- `userId`
- `ensembleId`
- `role`
- `sectionId`
- `sectionName`
- `joinedAt`

### Section

Stores a named subsection within an ensemble.

Typical fields:

- `sectionId`
- `ensembleId`
- `name`
- `description`
- `createdAt`
- `updatedAt`

### Upload

Stores metadata for files that live in S3.

Typical fields:

- `uploadId`
- `ownerId`
- `ensembleId`
- `fileKey`
- `fileType`
- `contentType`
- `createdAt`

### Submission

Stores a practice video submission for an assignment.

Typical fields:

- `submissionId`
- `assignmentId`
- `ensembleId`
- `sectionId`
- `ownerId`
- `videoKey`
- `notes`
- `reviewStatus`
- `feedback`
- `createdAt`
- `updatedAt`

### Comment

Stores a comment on a submission thread.

Typical fields:

- `commentId`
- `submissionId`
- `authorId`
- `body`
- `createdAt`
- `updatedAt`

### Notification

Stores a lightweight in-app notification for a user.

Typical fields:

- `userId`
- `notificationId`
- `type`
- `entityType`
- `entityId`
- `message`
- `isRead`
- `createdAt`
- `updatedAt`

## Storage Split

- User profiles and ensemble settings live in DynamoDB.
- File contents live in S3.
- DynamoDB keeps track of which S3 objects belong to which user or ensemble.

## Future Records

Implemented next:

- assignments
- submissions
- comments and feedback
- notifications

Later phases may add:

- progress tracking
- attendance history
- section-specific task lists
