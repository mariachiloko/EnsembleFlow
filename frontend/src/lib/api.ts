const rawApiUrl = import.meta.env.VITE_API_URL;

export const apiUrl =
  typeof rawApiUrl === "string" && rawApiUrl.trim().length > 0
    ? rawApiUrl.replace(/\/$/, "")
    : "";

export async function fetchHealthSignal(): Promise<string> {
  if (!apiUrl) {
    return "API URL not configured";
  }

  const response = await fetch(`${apiUrl}/health`, {
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    return `API returned ${response.status}`;
  }

  const data = (await response.json()) as { service?: string; ok?: boolean };

  if (data.ok) {
    return `Connected to ${data.service ?? "API"}`;
  }

  return "API responded without an ok flag";
}

type ApiOptions = {
  token?: string;
  body?: unknown;
  method?: string;
};

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  if (!apiUrl) {
    throw new Error("API URL not configured");
  }

  const response = await fetch(`${apiUrl}${path}`, {
    method: options.method ?? (options.body ? "POST" : "GET"),
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.message || `Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

export type ProfilePayload = {
  email?: string;
  displayName: string;
  photoKey?: string;
};

export type ProfileRecord = {
  userId: string;
  email: string;
  displayName: string;
  photoKey: string;
};

export type EnsemblePayload = {
  name: string;
  description?: string;
  logoKey?: string;
};

export type JoinRequestPayload = {
  ensembleCode: string;
  role?: string;
  sectionId?: string;
  sectionName?: string;
  inviteeUserId?: string;
  inviteeEmail?: string;
};

export type UploadPayload = {
  fileName: string;
  contentType: string;
  fileType: string;
  ensembleId?: string;
};

export type AssignmentPayload = {
  ensembleId: string;
  title: string;
  description?: string;
  dueDate: string;
};

export type SectionPayload = {
  ensembleId: string;
  name: string;
  description?: string;
};

export type MembershipPayload = {
  ensembleId: string;
  userId: string;
  role?: string;
  sectionId?: string;
  sectionName?: string;
};

export type SubmissionPayload = {
  assignmentId: string;
  sectionId?: string;
  videoKey?: string;
  notes?: string;
};

export type SubmissionReviewPayload = {
  reviewStatus?: string;
  feedback?: string;
  videoKey?: string;
  notes?: string;
};

export type CommentPayload = {
  submissionId: string;
  body: string;
};

export async function getCurrentProfile(token: string) {
  return request<{ profile: ProfileRecord | null }>("/profiles", { token });
}

export async function upsertProfile(token: string, payload: ProfilePayload) {
  return request<{ profile: ProfileRecord }>("/profiles", {
    token,
    body: payload,
    method: "POST",
  });
}

export async function listEnsembles(token: string) {
  return request<{
    ensembles: Array<{
      ensembleId: string;
      ownerId: string;
      name: string;
      description: string;
      logoKey: string;
    }>;
  }>("/ensembles", { token });
}

export async function createEnsemble(token: string, payload: EnsemblePayload) {
  return request<{
    ensemble: {
      ensembleId: string;
      ownerId: string;
      name: string;
      description: string;
      logoKey: string;
    };
    accessCode: string;
  }>("/ensembles", {
    token,
    body: payload,
    method: "POST",
  });
}

export async function createUploadPresign(token: string, payload: UploadPayload) {
  return request<{
    uploadId: string;
    fileKey: string;
    uploadUrl: string;
  }>("/uploads/presign", {
    token,
    body: payload,
    method: "POST",
  });
}

export async function listSections(token: string, ensembleId?: string) {
  const query = ensembleId ? `?ensembleId=${encodeURIComponent(ensembleId)}` : "";
  return request<{
    sections: Array<{
      sectionId: string;
      ensembleId: string;
      ownerId: string;
      name: string;
      description: string;
      createdAt: string;
      updatedAt: string;
    }>;
  }>(`/sections${query}`, { token });
}

export async function createSection(token: string, payload: SectionPayload) {
  return request<{
    section: {
      sectionId: string;
      ensembleId: string;
      ownerId: string;
      name: string;
      description: string;
      createdAt: string;
      updatedAt: string;
    };
  }>("/sections", {
    token,
    body: payload,
    method: "POST",
  });
}

export async function listMemberships(token: string, ensembleId?: string) {
  const query = ensembleId ? `?ensembleId=${encodeURIComponent(ensembleId)}` : "";
  return request<{
    memberships: Array<{
      userId: string;
      ensembleId: string;
      role: string;
      sectionId: string;
      sectionName: string;
      joinedAt: string;
      updatedAt: string;
    }>;
  }>(`/memberships${query}`, { token });
}

export async function createMembership(token: string, payload: MembershipPayload) {
  return request<{
    membership: {
      userId: string;
      ensembleId: string;
      role: string;
      sectionId: string;
      sectionName: string;
      joinedAt: string;
      updatedAt: string;
    };
  }>("/memberships", {
    token,
    body: payload,
    method: "POST",
  });
}

export async function removeMembership(token: string, userId: string, ensembleId: string) {
  return request<{ ok: boolean }>(`/memberships/${userId}/${ensembleId}`, {
    token,
    method: "DELETE",
  });
}

export async function listAssignments(token: string) {
  return listAssignmentsForEnsemble(token);
}

export async function listAssignmentsForEnsemble(token: string, ensembleId?: string) {
  const query = ensembleId ? `?ensembleId=${encodeURIComponent(ensembleId)}` : "";
  return request<{
    assignments: Array<{
      assignmentId: string;
      ownerId: string;
      ensembleId: string;
      title: string;
      description: string;
      dueDate: string;
      createdAt: string;
      updatedAt: string;
    }>;
  }>(`/assignments${query}`, { token });
}

export async function createAssignment(token: string, payload: AssignmentPayload) {
  return request<{
    assignment: {
      assignmentId: string;
      ownerId: string;
      ensembleId: string;
      title: string;
      description: string;
      dueDate: string;
      createdAt: string;
      updatedAt: string;
    };
  }>("/assignments", {
    token,
    body: payload,
    method: "POST",
  });
}

export async function updateAssignment(
  token: string,
  assignmentId: string,
  payload: Partial<AssignmentPayload>,
) {
  return request<{ assignment: { assignmentId: string } }>(
    `/assignments/${assignmentId}`,
    {
      token,
      body: payload,
      method: "PUT",
    },
  );
}

export async function listSubmissions(token: string, assignmentId?: string) {
  return listSubmissionsWithScope(token, assignmentId ? { assignmentId } : {});
}

export async function listSubmissionsWithScope(
  token: string,
  scope: { assignmentId?: string; sectionId?: string; ensembleId?: string } = {},
) {
  const params = new URLSearchParams();
  if (scope.assignmentId) params.set("assignmentId", scope.assignmentId);
  if (scope.sectionId) params.set("sectionId", scope.sectionId);
  if (scope.ensembleId) params.set("ensembleId", scope.ensembleId);
  const query = params.toString() ? `?${params.toString()}` : "";
  return request<{
    submissions: Array<{
      submissionId: string;
      assignmentId: string;
      ownerId: string;
      ensembleId: string;
      sectionId: string;
      videoKey: string;
      notes: string;
      reviewStatus: string;
      feedback: string;
      createdAt: string;
      updatedAt: string;
    }>;
  }>(`/submissions${query}`, { token });
}

export async function createSubmission(token: string, payload: SubmissionPayload) {
  return request<{
    submission: {
      submissionId: string;
      assignmentId: string;
      ownerId: string;
      ensembleId: string;
      sectionId: string;
      videoKey: string;
      notes: string;
      reviewStatus: string;
      feedback: string;
      createdAt: string;
      updatedAt: string;
    };
  }>("/submissions", {
    token,
    body: payload,
    method: "POST",
  });
}

export async function updateSubmission(
  token: string,
  submissionId: string,
  payload: SubmissionReviewPayload,
) {
  return request<{
    submission: {
      submissionId: string;
      assignmentId: string;
      ownerId: string;
      ensembleId: string;
      sectionId: string;
      videoKey: string;
      notes: string;
      reviewStatus: string;
      feedback: string;
      createdAt: string;
      updatedAt: string;
    };
  }>(`/submissions/${submissionId}`, {
    token,
    body: payload,
    method: "PUT",
  });
}

export async function listComments(token: string, submissionId: string) {
  return request<{
    comments: Array<{
      commentId: string;
      submissionId: string;
      authorId: string;
      body: string;
      createdAt: string;
      updatedAt: string;
    }>;
  }>(`/comments?submissionId=${encodeURIComponent(submissionId)}`, { token });
}

export async function createComment(token: string, payload: CommentPayload) {
  return request<{
    comment: {
      commentId: string;
      submissionId: string;
      authorId: string;
      body: string;
      createdAt: string;
      updatedAt: string;
    };
  }>("/comments", {
    token,
    body: payload,
    method: "POST",
  });
}

export async function listJoinRequests(token: string, ensembleId: string) {
  return request<{
    invitations: Array<{
      inviteCode: string;
      ensembleId: string;
      createdBy: string;
      inviteeEmail: string;
      inviteeUserId: string;
      role: string;
      sectionId: string;
      sectionName: string;
      status: string;
      acceptedBy: string;
      acceptedAt: string;
      createdAt: string;
      updatedAt: string;
    }>;
  }>(`/invitations?ensembleId=${encodeURIComponent(ensembleId)}`, { token });
}

export async function requestJoin(token: string, payload: JoinRequestPayload) {
  return request<{
    invitation: {
      inviteCode: string;
      ensembleId: string;
      createdBy: string;
      inviteeEmail: string;
      inviteeUserId: string;
      role: string;
      sectionId: string;
      sectionName: string;
      status: string;
      acceptedBy: string;
      acceptedAt: string;
      createdAt: string;
      updatedAt: string;
    };
  }>("/invitations", {
    token,
    body: payload,
    method: "POST",
  });
}

export async function approveJoinRequest(token: string, inviteCode: string) {
  return request<{
    membership: {
      userId: string;
      ensembleId: string;
      role: string;
      sectionId: string;
      sectionName: string;
      joinedAt: string;
      updatedAt: string;
    };
  }>("/invitations/accept", {
    token,
    body: { inviteCode },
    method: "POST",
  });
}

export async function listNotifications(token: string) {
  return request<{
    notifications: Array<{
      userId: string;
      notificationId: string;
      type: string;
      entityType: string;
      entityId: string;
      message: string;
      isRead: boolean;
      createdAt: string;
      updatedAt: string;
    }>;
  }>("/notifications", { token });
}

export async function markNotificationRead(token: string, notificationId: string) {
  return request<{
    notification: {
      userId: string;
      notificationId: string;
      type: string;
      entityType: string;
      entityId: string;
      message: string;
      isRead: boolean;
      createdAt: string;
      updatedAt: string;
    };
  }>(`/notifications/${notificationId}`, {
    token,
    body: { isRead: true },
    method: "PUT",
  });
}
