export const demoProfile = {
  userId: "demo-director",
  email: "director@example.com",
  displayName: "Director Demo",
  photoKey: "",
};

export const demoEnsembles = [
  {
    ensembleId: "demo-ensemble-mariachi",
    ownerId: demoProfile.userId,
    name: "Mariachi Los Soles",
    description: "Community ensemble with brass, strings, and vocals.",
    logoKey: "",
  },
  {
    ensembleId: "demo-ensemble-wind",
    ownerId: demoProfile.userId,
    name: "West Campus Wind Ensemble",
    description: "Student ensemble with sectional leaders.",
    logoKey: "",
  },
];

export const demoSections = [
  {
    sectionId: "demo-section-armonia",
    ensembleId: demoEnsembles[0].ensembleId,
    ownerId: demoProfile.userId,
    name: "Armonia",
    description: "Harmony and backing vocals",
    createdAt: "2026-05-01T12:00:00.000Z",
    updatedAt: "2026-05-01T12:00:00.000Z",
  },
  {
    sectionId: "demo-section-brass",
    ensembleId: demoEnsembles[0].ensembleId,
    ownerId: demoProfile.userId,
    name: "Brass",
    description: "Trumpets and trombones",
    createdAt: "2026-05-01T12:00:00.000Z",
    updatedAt: "2026-05-01T12:00:00.000Z",
  },
  {
    sectionId: "demo-section-percussion",
    ensembleId: demoEnsembles[1].ensembleId,
    ownerId: demoProfile.userId,
    name: "Percussion",
    description: "Rhythm section and drum line",
    createdAt: "2026-05-01T12:00:00.000Z",
    updatedAt: "2026-05-01T12:00:00.000Z",
  },
];

export const demoMemberships = [
  {
    userId: "demo-member-1",
    ensembleId: demoEnsembles[0].ensembleId,
    role: "member",
    sectionId: demoSections[0].sectionId,
    sectionName: demoSections[0].name,
    joinedAt: "2026-05-01T12:00:00.000Z",
    updatedAt: "2026-05-01T12:00:00.000Z",
  },
  {
    userId: "demo-member-2",
    ensembleId: demoEnsembles[0].ensembleId,
    role: "leader",
    sectionId: demoSections[1].sectionId,
    sectionName: demoSections[1].name,
    joinedAt: "2026-05-01T12:00:00.000Z",
    updatedAt: "2026-05-01T12:00:00.000Z",
  },
  {
    userId: "demo-member-3",
    ensembleId: demoEnsembles[1].ensembleId,
    role: "member",
    sectionId: demoSections[2].sectionId,
    sectionName: demoSections[2].name,
    joinedAt: "2026-05-01T12:00:00.000Z",
    updatedAt: "2026-05-01T12:00:00.000Z",
  },
];

export const demoAssignments = [
  {
    assignmentId: "demo-assignment-1",
    ownerId: demoProfile.userId,
    ensembleId: demoEnsembles[0].ensembleId,
    title: "Practice Arriba",
    description: "Focus on the opening melody and clean transitions.",
    dueDate: "2026-05-28",
    createdAt: "2026-05-01T12:00:00.000Z",
    updatedAt: "2026-05-01T12:00:00.000Z",
  },
  {
    assignmentId: "demo-assignment-2",
    ownerId: demoProfile.userId,
    ensembleId: demoEnsembles[1].ensembleId,
    title: "Section Balance",
    description: "Record a run-through and listen for tone blend.",
    dueDate: "2026-06-02",
    createdAt: "2026-05-01T12:00:00.000Z",
    updatedAt: "2026-05-01T12:00:00.000Z",
  },
];

export const demoSubmissions = [
  {
    submissionId: "demo-submission-1",
    assignmentId: demoAssignments[0].assignmentId,
    ownerId: "demo-member-1",
    ensembleId: demoEnsembles[0].ensembleId,
    sectionId: demoSections[0].sectionId,
    videoKey: "uploads/demo-member-1/demo-submission-1.mp4",
    notes: "Recorded after a section warmup.",
    reviewStatus: "needs_work",
    feedback: "Tighten the ending cadence and watch the tempo shift.",
    createdAt: "2026-05-04T12:00:00.000Z",
    updatedAt: "2026-05-05T12:00:00.000Z",
  },
  {
    submissionId: "demo-submission-2",
    assignmentId: demoAssignments[0].assignmentId,
    ownerId: "demo-member-2",
    ensembleId: demoEnsembles[0].ensembleId,
    sectionId: demoSections[1].sectionId,
    videoKey: "uploads/demo-member-2/demo-submission-2.mp4",
    notes: "Second take with feedback from the section lead.",
    reviewStatus: "approved",
    feedback: "Much cleaner. Keep this approach for the live rehearsal.",
    createdAt: "2026-05-04T12:00:00.000Z",
    updatedAt: "2026-05-05T12:00:00.000Z",
  },
];

export const demoComments = [
  {
    commentId: "demo-comment-1",
    submissionId: demoSubmissions[0].submissionId,
    authorId: demoProfile.userId,
    body: "Good start. The rhythm is solid, but the ending needs a little more lock-in.",
    createdAt: "2026-05-05T12:05:00.000Z",
    updatedAt: "2026-05-05T12:05:00.000Z",
  },
  {
    commentId: "demo-comment-2",
    submissionId: demoSubmissions[0].submissionId,
    authorId: "demo-member-2",
    body: "I can hear the same spot. I’ll take another pass tonight.",
    createdAt: "2026-05-05T12:07:00.000Z",
    updatedAt: "2026-05-05T12:07:00.000Z",
  },
];

export const demoNotifications = [
  {
    userId: demoProfile.userId,
    notificationId: "demo-notification-1",
    type: "submission",
    entityType: "submission",
    entityId: demoSubmissions[0].submissionId,
    message: "A member submitted a practice video.",
    isRead: false,
    createdAt: "2026-05-05T12:00:00.000Z",
    updatedAt: "2026-05-05T12:00:00.000Z",
  },
  {
    userId: demoProfile.userId,
    notificationId: "demo-notification-2",
    type: "comment",
    entityType: "submission",
    entityId: demoSubmissions[0].submissionId,
    message: "A new comment was added to a submission.",
    isRead: true,
    createdAt: "2026-05-05T12:08:00.000Z",
    updatedAt: "2026-05-05T12:08:00.000Z",
  },
];
