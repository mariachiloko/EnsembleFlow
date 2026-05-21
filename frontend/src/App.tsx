import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  apiUrl,
  createAssignment,
  createComment,
  createMembership,
  createEnsemble,
  createSection,
  createSubmission,
  createUploadPresign,
  approveJoinRequest,
  fetchHealthSignal,
  getCurrentProfile,
  listAssignmentsForEnsemble,
  listComments,
  listMemberships,
  listEnsembles,
  listJoinRequests,
  listSections,
  listSubmissionsWithScope,
  listNotifications,
  markNotificationRead,
  removeMembership,
  requestJoin,
  updateSubmission,
  upsertProfile,
} from "./lib/api";
import {
  beginCognitoSignIn,
  buildCognitoLogoutUrl,
  clearSession,
  cognitoClientId,
  cognitoDomain,
  cognitoLogoutUri,
  cognitoRedirectUri,
  getAuthStatusText,
  handleCognitoCallback,
  loadStoredSession,
  type AuthSession,
} from "./lib/auth";
import {
  demoAssignments,
  demoComments,
  demoEnsembles,
  demoMemberships,
  demoNotifications,
  demoProfile,
  demoSections,
  demoSubmissions,
} from "./demoData";

const dashboardCards = [
  {
    title: "My profile",
    body: "Store display name, photo, and email for each account.",
  },
  {
    title: "My ensembles",
    body: "See the groups you belong to and open the one you need.",
  },
  {
    title: "My assignments",
    body: "Track due dates and see what is expected next.",
  },
  {
    title: "My submissions",
    body: "Upload practice videos and follow the feedback thread.",
  },
];

const rolloutSteps = [
  "Log in",
  "Create or edit a profile",
  "Add an ensemble",
  "Upload photos and logos",
  "Track assignments and submissions",
];

const navigationSections = [
  { id: "overview", label: "Overview" },
  { id: "profile", label: "Profile" },
  { id: "ensembles", label: "Ensembles" },
  { id: "structure", label: "Sections" },
  { id: "assignments", label: "Assignments" },
  { id: "submissions", label: "Submissions" },
  { id: "notifications", label: "Updates" },
  { id: "feedback", label: "Feedback" },
  { id: "media", label: "Media" },
];

const placeholderProfile = demoProfile;

function decodeJwtPayload(token?: string) {
  if (!token) {
    return {};
  }

  const parts = token.split(".");
  if (parts.length < 2) {
    return {};
  }

  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, "=");
    return JSON.parse(window.atob(padded)) as Record<string, string>;
  } catch {
    return {};
  }
}

function getInitials(value: string) {
  const words = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!words.length) {
    return "M";
  }

  return words
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

function App() {
  const [apiState, setApiState] = useState("Checking backend connection...");
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    const storedTheme = window.localStorage.getItem("ensembleflow-theme");
    if (storedTheme === "dark" || storedTheme === "light") {
      return storedTheme;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [activeSection, setActiveSection] = useState("overview");
  const [tokenDraft, setTokenDraft] = useState("");
  const [profile, setProfile] = useState(placeholderProfile);
  const [remoteEnsembles, setRemoteEnsembles] = useState<Array<{
    ensembleId: string;
    ownerId: string;
    name: string;
    description: string;
    logoKey: string;
  }>>([]);
  const [remoteSections, setRemoteSections] = useState<Array<{
    sectionId: string;
    ensembleId: string;
    ownerId: string;
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
  }>>([]);
  const [remoteMemberships, setRemoteMemberships] = useState<Array<{
    userId: string;
    ensembleId: string;
    role: string;
    sectionId: string;
    sectionName: string;
    joinedAt: string;
    updatedAt: string;
  }>>([]);
  const [remoteAssignments, setRemoteAssignments] = useState<Array<{
    assignmentId: string;
    ownerId: string;
    ensembleId: string;
    title: string;
    description: string;
    dueDate: string;
    createdAt: string;
    updatedAt: string;
  }>>([]);
  const [remoteComments, setRemoteComments] = useState<Array<{
    commentId: string;
    submissionId: string;
    authorId: string;
    body: string;
    createdAt: string;
    updatedAt: string;
  }>>([]);
  const [remoteNotifications, setRemoteNotifications] = useState<Array<{
    userId: string;
    notificationId: string;
    type: string;
    entityType: string;
    entityId: string;
    message: string;
    isRead: boolean;
    createdAt: string;
    updatedAt: string;
  }>>([]);
  const [remoteSubmissions, setRemoteSubmissions] = useState<Array<{
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
  }>>([]);
  const [displayName, setDisplayName] = useState(placeholderProfile.displayName);
  const [email, setEmail] = useState(placeholderProfile.email);
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [ensembleName, setEnsembleName] = useState("New ensemble");
  const [ensembleDescription, setEnsembleDescription] = useState("");
  const [ensembleLogoFile, setEnsembleLogoFile] = useState<File | null>(null);
  const [structureEnsembleId, setStructureEnsembleId] = useState("");
  const [sectionName, setSectionName] = useState("Brass");
  const [sectionDescription, setSectionDescription] = useState("");
  const [membershipUserId, setMembershipUserId] = useState("");
  const [membershipRole, setMembershipRole] = useState("member");
  const [membershipSectionId, setMembershipSectionId] = useState("");
  const [joinCodeDraft, setJoinCodeDraft] = useState("");
  const [lastAccessCode, setLastAccessCode] = useState("");
  const [remoteJoinRequests, setRemoteJoinRequests] = useState<Array<{
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
  }>>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadEnsembleId, setUploadEnsembleId] = useState("");
  const [commentSubmissionId, setCommentSubmissionId] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [assignmentTitle, setAssignmentTitle] = useState("New assignment");
  const [assignmentDescription, setAssignmentDescription] = useState("");
  const [assignmentDueDate, setAssignmentDueDate] = useState("");
  const [assignmentEnsembleId, setAssignmentEnsembleId] = useState("");
  const [submissionAssignmentId, setSubmissionAssignmentId] = useState("");
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [reviewSubmissionId, setReviewSubmissionId] = useState("");
  const [reviewStatus, setReviewStatus] = useState("approved");
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [authMessage, setAuthMessage] = useState("Not signed in.");
  const [formBusy, setFormBusy] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastKind, setToastKind] = useState<"success" | "error" | "info">("success");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("ensembleflow-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!formMessage) {
      return;
    }

    const isToastable = !/^(Saving|Preparing|Loading|Sending|Approving|Removing|Checking)/i.test(formMessage) &&
      !formMessage.endsWith("...");

    if (!isToastable) {
      return;
    }

    const kind = /failed|error|missing|invalid|unavailable|denied/i.test(formMessage)
      ? "error"
      : "success";

    setToastKind(kind);
    setToastMessage(formMessage);

    const timeout = window.setTimeout(() => setToastMessage(""), 2800);
    return () => window.clearTimeout(timeout);
  }, [formMessage]);

  useEffect(() => {
    let cancelled = false;

    async function checkApi() {
      try {
        const status = await fetchHealthSignal();
        if (!cancelled) {
          setApiState(status);
        }
      } catch {
        if (!cancelled) {
          setApiState("Backend connection unavailable");
        }
      }
    }

    void checkApi();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initializeAuth() {
      const stored = loadStoredSession();
      if (stored) {
        setAuthSession(stored);
        setAccessToken(stored.accessToken);
        setAuthMessage(getAuthStatusText(stored));
      }

      try {
        const session = await handleCognitoCallback();
        if (!cancelled && session) {
          setAuthSession(session);
          setAccessToken(session.accessToken);
          setAuthMessage(getAuthStatusText(session));
          window.history.replaceState({}, document.title, window.location.pathname);
          setFormMessage("Signed in.");
        }
      } catch (error) {
        if (!cancelled) {
          setAuthMessage(error instanceof Error ? error.message : "Auth callback failed.");
        }
      }
    }

    void initializeAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      if (!accessToken) {
        setProfile(placeholderProfile);
        setRemoteEnsembles([]);
        setRemoteSections([]);
        setRemoteMemberships([]);
        setRemoteAssignments([]);
        setRemoteSubmissions([]);
        setRemoteComments([]);
        setRemoteNotifications([]);
        setRemoteJoinRequests([]);
        setLastAccessCode("");
        setStructureEnsembleId("");
        setCommentSubmissionId("");
        return;
      }

      setProfile({
        userId: "",
        email: "",
        displayName: "",
        photoKey: "",
      });
      setDisplayName("");
      setEmail(sessionClaims.email || "");

      try {
        const [profileResponse, ensemblesResponse, notificationsResponse] = await Promise.all([
          getCurrentProfile(accessToken),
          listEnsembles(accessToken),
          listNotifications(accessToken),
        ]);

        if (cancelled) return;

        if (profileResponse.profile) {
          setProfile(profileResponse.profile);
          setDisplayName(profileResponse.profile.displayName || "");
          setEmail(profileResponse.profile.email || "");
        }

        setRemoteEnsembles(ensemblesResponse.ensembles);
        setRemoteNotifications(notificationsResponse.notifications);
      } catch (error) {
        if (!cancelled) {
          setFormMessage(error instanceof Error ? error.message : "Could not load workspace data.");
        }
      }
    }

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    if (!remoteEnsembles.length) {
      return;
    }

    const firstEnsembleId = remoteEnsembles[0]?.ensembleId || "";

    if (!structureEnsembleId && firstEnsembleId) {
      setStructureEnsembleId(firstEnsembleId);
    }

    if (!assignmentEnsembleId && firstEnsembleId) {
      setAssignmentEnsembleId(firstEnsembleId);
    }

    if (!uploadEnsembleId && firstEnsembleId) {
      setUploadEnsembleId(firstEnsembleId);
    }
  }, [remoteEnsembles, structureEnsembleId, assignmentEnsembleId, uploadEnsembleId]);

  useEffect(() => {
    let cancelled = false;

    async function loadStructure() {
      if (!accessToken || !structureEnsembleId) {
        setRemoteSections([]);
        setRemoteMemberships([]);
        setRemoteAssignments([]);
        setRemoteSubmissions([]);
        setRemoteComments([]);
        setCommentSubmissionId("");
        return;
      }

      try {
        const [sectionsResponse, membershipsResponse, assignmentsResponse, submissionsResponse] =
          await Promise.all([
          listSections(accessToken, structureEnsembleId),
          listMemberships(accessToken, structureEnsembleId),
          listAssignmentsForEnsemble(accessToken, structureEnsembleId),
          listSubmissionsWithScope(accessToken, { ensembleId: structureEnsembleId }),
        ]);

        if (cancelled) return;

        setRemoteSections(sectionsResponse.sections);
        setRemoteMemberships(membershipsResponse.memberships);
        setRemoteAssignments(assignmentsResponse.assignments);
        setRemoteSubmissions(submissionsResponse.submissions);
        if (!membershipSectionId) {
          setMembershipSectionId(sectionsResponse.sections[0]?.sectionId || "");
        }
        if (!assignmentEnsembleId) {
          setAssignmentEnsembleId(structureEnsembleId);
        }
        if (!uploadEnsembleId) {
          setUploadEnsembleId(structureEnsembleId);
        }
        if (!submissionAssignmentId) {
          setSubmissionAssignmentId(assignmentsResponse.assignments[0]?.assignmentId || "");
        }
        if (!reviewSubmissionId) {
          setReviewSubmissionId(submissionsResponse.submissions[0]?.submissionId || "");
        }
        if (!commentSubmissionId) {
          setCommentSubmissionId(submissionsResponse.submissions[0]?.submissionId || "");
        }
      } catch (error) {
        if (!cancelled) {
          setFormMessage(error instanceof Error ? error.message : "Could not load structure data.");
        }
      }
    }

    void loadStructure();

    return () => {
      cancelled = true;
    };
  }, [
    accessToken,
    structureEnsembleId,
    membershipSectionId,
    assignmentEnsembleId,
    uploadEnsembleId,
    submissionAssignmentId,
    reviewSubmissionId,
    commentSubmissionId,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function loadCommentThread() {
      if (!accessToken || !commentSubmissionId) {
        setRemoteComments([]);
        return;
      }

      try {
        const response = await listComments(accessToken, commentSubmissionId);
        if (!cancelled) {
          setRemoteComments(response.comments);
        }
      } catch (error) {
        if (!cancelled) {
          setFormMessage(error instanceof Error ? error.message : "Could not load comments.");
        }
      }
    }

    void loadCommentThread();

    return () => {
      cancelled = true;
    };
  }, [accessToken, commentSubmissionId]);

  useEffect(() => {
    let cancelled = false;

    async function loadJoinRequests() {
      const selectedEnsemble = remoteEnsembles.find(
        (ensemble) => ensemble.ensembleId === structureEnsembleId,
      );
      const selectedMembership = remoteMemberships.find(
        (membership) => membership.ensembleId === structureEnsembleId,
      );
      const canManageCurrentEnsemble =
        Boolean(selectedEnsemble && selectedEnsemble.ownerId === profile.userId) ||
        Boolean(
          selectedMembership &&
            (selectedMembership.role === "director" ||
              selectedMembership.role === "co_director" ||
              selectedMembership.role === "leader"),
        );

      if (!accessToken || !structureEnsembleId || !canManageCurrentEnsemble) {
        setRemoteJoinRequests([]);
        return;
      }

      try {
        const response = await listJoinRequests(accessToken, structureEnsembleId);
        if (!cancelled) {
          setRemoteJoinRequests(response.invitations);
        }
      } catch {
        if (!cancelled) {
          setRemoteJoinRequests([]);
        }
      }
    }

    void loadJoinRequests();

    return () => {
      cancelled = true;
    };
  }, [accessToken, structureEnsembleId, profile.userId, remoteEnsembles, remoteMemberships]);

  const connectionLabel = useMemo(() => {
    if (!apiUrl) {
      return "Preview mode";
    }

    return "Live backend connected";
  }, []);

  const displayedEnsembles = remoteEnsembles.length
    ? remoteEnsembles
    : demoEnsembles;
  const visibleSections = remoteSections.length
    ? remoteSections
    : demoSections.filter((section) => section.ensembleId === structureEnsembleId || !structureEnsembleId);
  const visibleMemberships = remoteMemberships.length
    ? remoteMemberships
    : demoMemberships.filter(
        (membership) =>
          membership.ensembleId === structureEnsembleId || !structureEnsembleId,
      );
  const activeSections = visibleSections.filter(
    (section) => section.ensembleId === structureEnsembleId,
  );
  const activeMemberships = visibleMemberships.filter(
    (membership) => membership.ensembleId === structureEnsembleId,
  );
  const visibleAssignments = remoteAssignments.length
    ? remoteAssignments
    : demoAssignments.filter(
        (assignment) =>
          assignment.ensembleId === structureEnsembleId || !structureEnsembleId,
      );
  const visibleSubmissions = remoteSubmissions.length
    ? remoteSubmissions
    : demoSubmissions.filter(
        (submission) =>
          submission.ensembleId === structureEnsembleId || !structureEnsembleId,
      );
  const visibleComments = remoteComments.length ? remoteComments : demoComments;
  const visibleNotifications = remoteNotifications.length ? remoteNotifications : demoNotifications;
  const currentEnsemble = displayedEnsembles.find(
    (ensemble) => ensemble.ensembleId === structureEnsembleId,
  );
  const sessionClaims = useMemo(() => decodeJwtPayload(authSession?.idToken), [authSession?.idToken]);
  const signedInName = accessToken
    ? (profile.displayName.trim() &&
        profile.displayName !== placeholderProfile.displayName
          ? profile.displayName.trim()
          : sessionClaims.name || sessionClaims.email || "Musician")
    : placeholderProfile.displayName;
  const signedInEmail = accessToken
    ? (profile.email.trim() && profile.email !== placeholderProfile.email
        ? profile.email.trim()
        : sessionClaims.email || "")
    : placeholderProfile.email;
  const avatarInitials = getInitials(signedInName);
  const selectedSubmission =
    visibleSubmissions.find((submission) => submission.submissionId === commentSubmissionId) ||
    visibleSubmissions[0] ||
    null;
  const isDirectorMode = Boolean(currentEnsemble && currentEnsemble.ownerId === profile.userId) ||
    visibleMemberships.some(
      (membership) =>
        membership.role === "director" || membership.role === "co_director" || membership.role === "leader",
    );
  const unreadNotificationCount = visibleNotifications.filter((notification) => !notification.isRead).length;
  const showWorkspace = Boolean(accessToken);
  const workspaceModeLabel = isDirectorMode ? "Management workspace" : "Member workspace";

  async function handleApplyToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthSession(null);
    setAccessToken(tokenDraft.trim());
    setAuthMessage(tokenDraft.trim() ? "Manual access token loaded." : "Manual token cleared.");
    setFormMessage(
      tokenDraft.trim()
        ? "Access token set. The workspace will load your profile and ensembles."
        : "Token cleared. The forms will stay in preview mode.",
    );
  }

  async function handleSignIn() {
    try {
      await beginCognitoSignIn();
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "Could not start sign-in.");
    }
  }

  async function handleSignOut() {
    clearSession();
    setAuthSession(null);
    setAccessToken("");
    setTokenDraft("");
    setRemoteEnsembles([]);
    setRemoteSections([]);
    setRemoteMemberships([]);
    setRemoteAssignments([]);
    setRemoteSubmissions([]);
    setRemoteComments([]);
    setRemoteNotifications([]);
    setRemoteJoinRequests([]);
    setLastAccessCode("");
    setProfile(placeholderProfile);
    setDisplayName(placeholderProfile.displayName);
    setEmail(placeholderProfile.email);
    setStructureEnsembleId("");
    setAssignmentEnsembleId("");
    setUploadEnsembleId("");
    setMembershipSectionId("");
    setCommentSubmissionId("");
    setCommentBody("");
    setProfileModalOpen(false);
    setAuthMessage("Signed out.");
    setFormMessage("Signed out.");

    const logoutUrl = buildCognitoLogoutUrl();
    if (logoutUrl) {
      window.location.assign(logoutUrl);
    }
  }

  async function uploadFileToS3(
    file: File,
    fileType: string,
    ensembleId?: string,
  ) {
    if (!accessToken) {
      throw new Error("Sign in or paste an access token first.");
    }

    const presign = await createUploadPresign(accessToken, {
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      fileType,
      ensembleId,
    });

    const uploadResponse = await fetch(presign.uploadUrl, {
      method: "PUT",
      headers: {
        "content-type": file.type || "application/octet-stream",
      },
      body: file,
    });

    if (!uploadResponse.ok) {
      throw new Error("Upload failed.");
    }

    return presign.fileKey;
  }

  async function reloadNotifications() {
    if (!accessToken) {
      return;
    }

    try {
      const response = await listNotifications(accessToken);
      setRemoteNotifications(response.notifications);
    } catch {
      // Keep the existing inbox if the refresh fails.
    }
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormBusy(true);
    setFormMessage("Saving profile...");

    try {
      let photoKey = profile.photoKey;

      if (profilePhotoFile) {
        photoKey = await uploadFileToS3(profilePhotoFile, "profile-photo");
      }

      const result = await upsertProfile(accessToken, {
        email,
        displayName,
        photoKey,
      });

      setProfile(result.profile);
      setFormMessage("Profile saved.");
      setProfilePhotoFile(null);
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Profile save failed.");
    } finally {
      setFormBusy(false);
    }
  }

  async function handleEnsembleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormBusy(true);
    setFormMessage("Saving ensemble...");

    try {
      let logoKey = "";

      if (ensembleLogoFile) {
        logoKey = await uploadFileToS3(ensembleLogoFile, "ensemble-logo");
      }

      const result = await createEnsemble(accessToken, {
        name: ensembleName,
        description: ensembleDescription,
        logoKey,
      });

      setRemoteEnsembles((current) => [result.ensemble, ...current]);
      setLastAccessCode(result.accessCode || "");
      setFormMessage("Ensemble saved.");
      setEnsembleName("");
      setEnsembleDescription("");
      setEnsembleLogoFile(null);
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Ensemble save failed.");
    } finally {
      setFormBusy(false);
    }
  }

  async function handleSectionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!structureEnsembleId) {
      setFormMessage("Choose an ensemble before creating a section.");
      return;
    }

    setFormBusy(true);
    setFormMessage("Saving section...");

    try {
      const result = await createSection(accessToken, {
        ensembleId: structureEnsembleId,
        name: sectionName,
        description: sectionDescription,
      });

      setRemoteSections((current) => [result.section, ...current]);
      if (!membershipSectionId) {
        setMembershipSectionId(result.section.sectionId);
      }
      setFormMessage("Section saved.");
      setSectionName("");
      setSectionDescription("");
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Section save failed.");
    } finally {
      setFormBusy(false);
    }
  }

  async function handleMembershipSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!structureEnsembleId) {
      setFormMessage("Choose an ensemble before creating a membership.");
      return;
    }

    setFormBusy(true);
    setFormMessage("Saving membership...");

    try {
      const section = visibleSections.find((item) => item.sectionId === membershipSectionId);
      const result = await createMembership(accessToken, {
        ensembleId: structureEnsembleId,
        userId: membershipUserId,
        role: membershipRole,
        sectionId: membershipSectionId,
        sectionName: section?.name || "",
      });

      setRemoteMemberships((current) => [result.membership, ...current]);
      setFormMessage("Membership saved.");
      setMembershipUserId("");
      setMembershipRole("member");
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Membership save failed.");
    } finally {
      setFormBusy(false);
    }
  }

  async function handleJoinRequestSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!joinCodeDraft.trim()) {
      setFormMessage("Enter an ensemble code first.");
      return;
    }

    setFormBusy(true);
    setFormMessage("Sending join request...");

    try {
      await requestJoin(accessToken, { ensembleCode: joinCodeDraft.trim() });
      setJoinCodeDraft("");
      setFormMessage("Join request sent. A director will approve it.");
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Join request failed.");
    } finally {
      setFormBusy(false);
    }
  }

  async function handleApproveRequest(inviteCode: string) {
    setFormMessage("Approving join request...");
    try {
      await approveJoinRequest(accessToken, inviteCode);
      setRemoteJoinRequests((current) => current.filter((item) => item.inviteCode !== inviteCode));
      setFormMessage("Join request approved.");
      await reloadNotifications();
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Approval failed.");
    }
  }

  async function handleRemoveMember(userId: string, ensembleId: string) {
    setFormMessage("Removing member...");
    try {
      await removeMembership(accessToken, userId, ensembleId);
      setRemoteMemberships((current) =>
        current.filter((membership) => !(membership.userId === userId && membership.ensembleId === ensembleId)),
      );
      setFormMessage("Member removed.");
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Member removal failed.");
    }
  }

  async function handleUploadSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uploadFile) {
      setFormMessage("Choose a file first.");
      return;
    }

    setFormBusy(true);
    setFormMessage("Preparing upload...");

    try {
      const fileKey = await uploadFileToS3(uploadFile, "practice-media", uploadEnsembleId || undefined);
      setFormMessage(`Uploaded to ${fileKey}.`);
      setUploadFile(null);
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setFormBusy(false);
    }
  }

  async function handleAssignmentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assignmentEnsembleId) {
      setFormMessage("Choose an ensemble before creating an assignment.");
      return;
    }

    setFormBusy(true);
    setFormMessage("Saving assignment...");

    try {
      const result = await createAssignment(accessToken, {
        ensembleId: assignmentEnsembleId,
        title: assignmentTitle,
        description: assignmentDescription,
        dueDate: assignmentDueDate,
      });

      setRemoteAssignments((current) => [result.assignment, ...current]);
      setFormMessage("Assignment saved.");
      setAssignmentTitle("New assignment");
      setAssignmentDescription("");
      setAssignmentDueDate("");
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Assignment save failed.");
    } finally {
      setFormBusy(false);
    }
  }

  async function handleSubmissionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!submissionAssignmentId) {
      setFormMessage("Choose an assignment before uploading a submission.");
      return;
    }

    setFormBusy(true);
    setFormMessage("Saving submission...");

    try {
      let videoKey = "";

      if (submissionFile) {
        videoKey = await uploadFileToS3(submissionFile, "submission-video");
      }

      const result = await createSubmission(accessToken, {
        assignmentId: submissionAssignmentId,
        notes: submissionNotes,
        videoKey,
      });

      setRemoteSubmissions((current) => [result.submission, ...current]);
      setCommentSubmissionId(result.submission.submissionId);
      setReviewSubmissionId(result.submission.submissionId);
      setFormMessage("Submission saved.");
      setSubmissionFile(null);
      setSubmissionNotes("");
      await reloadNotifications();
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Submission save failed.");
    } finally {
      setFormBusy(false);
    }
  }

  async function handleReviewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reviewSubmissionId) {
      setFormMessage("Choose a submission before saving feedback.");
      return;
    }

    setFormBusy(true);
    setFormMessage("Saving review...");

    try {
      const result = await updateSubmission(accessToken, reviewSubmissionId, {
        reviewStatus,
        feedback: reviewFeedback,
      });

      setRemoteSubmissions((current) =>
        current.map((submission) =>
          submission.submissionId === result.submission.submissionId ? result.submission : submission,
        ),
      );
      setFormMessage("Feedback saved.");
      setReviewFeedback("");
      await reloadNotifications();
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Review save failed.");
    } finally {
      setFormBusy(false);
    }
  }

  async function handleCommentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!commentSubmissionId) {
      setFormMessage("Choose a submission before adding a comment.");
      return;
    }

    if (!commentBody.trim()) {
      setFormMessage("Enter a comment first.");
      return;
    }

    setFormBusy(true);
    setFormMessage("Saving comment...");

    try {
      const result = await createComment(accessToken, {
        submissionId: commentSubmissionId,
        body: commentBody.trim(),
      });

      setRemoteComments((current) => [...current, result.comment]);
      setCommentBody("");
      setFormMessage("Comment saved.");
      await reloadNotifications();
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Comment save failed.");
    } finally {
      setFormBusy(false);
    }
  }

  if (!showWorkspace) {
    return (
      <main className="auth-shell">
        <section className="auth-hero panel panel-accent">
          <p className="eyebrow">EnsembleFlow</p>
          <h1>Sign in to manage your ensemble.</h1>
          <p className="lede">
            Use the hosted sign-in to create an account or log in with email. Once you are signed in,
            you can request access to an ensemble with a code and start using the workspace.
          </p>
          <p className="muted-copy">
            Sign in with email and password. Use the forgot-password link if you need a reset.
            Google sign-in is not connected yet.
          </p>
        </section>

        <section className="auth-grid">
          <div className="panel form-panel">
            <h3>Sign in or sign up</h3>
            <p className="muted-copy">
              {cognitoDomain && cognitoClientId && cognitoRedirectUri
                ? "The hosted sign-in is ready and uses email."
                : "Set the sign-in environment variables to enable hosted login."}
            </p>
            <div className="form-actions">
              <button
                className="button button-primary"
                type="button"
                onClick={handleSignIn}
                disabled={!cognitoDomain || !cognitoClientId || !cognitoRedirectUri}
              >
                Continue with email
              </button>
            </div>
            <p className="muted-copy">The hosted sign-in page supports email sign-up.</p>
            <p className="muted-copy">Password resets go through Cognito email recovery.</p>
            <p className="muted-copy">Google sign-in is not wired up in this environment.</p>
          </div>

          <div className="panel form-panel">
            <h3>Status</h3>
            <p>{authMessage}</p>
            <p className="muted-copy">{apiState}</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar panel">
        <div>
          <p className="eyebrow">EnsembleFlow</p>
          <h2>Workspace</h2>
          <p className="muted-copy">
            Manage your profile, ensembles, assignments, submissions, and updates in one place.
          </p>
        </div>

        <div className="sidebar-status">
          <span className="status-chip">{apiState}</span>
          <span className="status-chip status-chip-muted">{authMessage}</span>
          <span className="status-chip">{isDirectorMode ? "Admin" : "Member"}</span>
        </div>

        <div className="sidebar-actions">
          <button
            className="button button-secondary"
            type="button"
            onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Workspace navigation">
          {navigationSections.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`sidebar-link ${activeSection === item.id ? "sidebar-link-active" : ""}`}
              onClick={() => {
                setActiveSection(item.id);
                document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <p className="muted-copy">Current status</p>
          <p className="sidebar-footer-value">{connectionLabel}</p>
        </div>
      </aside>

      <div className="workspace">
        <section className="hero" id="overview">
          <div className="hero-topline">
            <p className="eyebrow">EnsembleFlow</p>
            <div className="topline-statuses">
              <span className="status-chip">{apiState}</span>
              <span className="status-chip status-chip-muted">{authMessage}</span>
              <span className="status-chip">{workspaceModeLabel}</span>
            </div>
          </div>
          <div className="hero-grid hero-grid-main">
            <div>
              <h1>Keep ensembles organized and accountable.</h1>
              <p className="lede">
                EnsembleFlow brings profiles, groups, sections, media, and practice tracking into one workspace for music teams.
              </p>
            </div>

            <article className="panel panel-accent">
              <h2>How it works</h2>
              <ol className="phase-list">
                {rolloutSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </article>
          </div>

          <div className="card-grid dashboard-grid">
            <article className="panel account-card">
              <div className="avatar-circle" aria-hidden="true">
                {avatarInitials}
              </div>
              <div className="account-copy">
                <p className="eyebrow">Signed in</p>
                <h2>Hello, {signedInName}</h2>
                <p className="muted-copy">
                  {signedInEmail ? signedInEmail : "Your email comes from sign-in."}
                </p>
              </div>
              <div className="account-actions">
                <button className="button button-primary" type="button" onClick={() => setProfileModalOpen(true)}>
                  Edit profile photo
                </button>
                <button className="button button-secondary" type="button" onClick={handleSignOut}>
                  Sign out
                </button>
              </div>
            </article>

            <article className="panel">
              <h3>Join an ensemble</h3>
              <p className="muted-copy">Enter a code from a director to request access.</p>
              <form className="mini-form" onSubmit={handleJoinRequestSubmit}>
                <label className="field">
                  <span>Ensemble code</span>
                  <input
                    value={joinCodeDraft}
                    onChange={(event) => setJoinCodeDraft(event.target.value.toUpperCase())}
                    placeholder="ENTER CODE"
                  />
                </label>
                <div className="form-actions">
                  <button className="button button-primary" type="submit" disabled={formBusy}>
                    Request access
                  </button>
                </div>
              </form>
            </article>
          </div>
        </section>

        <section className="section" id="overview-details">
          <div className="section-header">
            <div>
              <h2>{workspaceModeLabel}</h2>
              <p>
                {isDirectorMode
                  ? "Manage ensembles, sections, memberships, assignments, and feedback."
                  : "Focus on your ensembles, your assignments, your submissions, and your section feed."}
              </p>
            </div>
            <p className="section-meta">{connectionLabel}</p>
          </div>

          <div className="card-grid dashboard-grid">
            {dashboardCards.map((item) => (
              <article className="panel" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>

          <article className="panel panel-accent">
            <h3>What you can do here</h3>
            <p>
              {isDirectorMode
                ? "Create assignments, approve join requests, place people in sections, and leave feedback."
                : "Open your ensembles, submit practice videos, and reply to feedback inside your section."}
            </p>
            <p className="muted-copy">Notifications waiting: {unreadNotificationCount}</p>
          </article>
        </section>

      <section className="section" id="profile">
        <div className="section-header">
          <div>
            <h2>My profile</h2>
            <p>Create or update your name and profile photo.</p>
          </div>
          <p className="section-meta">
            Current profile: {profile.displayName || "Not loaded yet"}
          </p>
        </div>

        <article className="panel">
          <div className="profile-hero">
            <div className="avatar-circle avatar-circle-large" aria-hidden="true">
              {avatarInitials}
            </div>
            <div>
              <h3>{signedInName}</h3>
              <p className="muted-copy">{signedInEmail || "Your email comes from sign-in."}</p>
            </div>
          </div>
          <div className="form-actions">
            <button className="button button-primary" type="button" onClick={() => setProfileModalOpen(true)}>
              Edit profile photo
            </button>
          </div>
        </article>
      </section>

      <section className="section" id="ensembles">
        <div className="section-header">
          <div>
            <h2>{isDirectorMode ? "Ensembles" : "My ensembles"}</h2>
            <p>
              {isDirectorMode
                ? "Add new groups and keep their logos and descriptions organized."
                : "See the ensembles you belong to and open the one you want to work in."}
            </p>
          </div>
        </div>

        <form className="panel form-panel" onSubmit={handleEnsembleSubmit}>
          <div className="form-grid">
            <label className="field">
              <span>Ensemble name</span>
              <input
                value={ensembleName}
                onChange={(event) => setEnsembleName(event.target.value)}
                placeholder="New ensemble"
              />
            </label>
            <label className="field">
              <span>Logo</span>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => setEnsembleLogoFile(event.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <label className="field">
            <span>Description</span>
            <textarea
              value={ensembleDescription}
              onChange={(event) => setEnsembleDescription(event.target.value)}
              placeholder="Short ensemble description"
              rows={3}
            />
          </label>
          <div className="form-actions">
            <button className="button button-primary" type="submit" disabled={formBusy}>
              Save ensemble
            </button>
          </div>
        </form>

        {lastAccessCode ? (
          <article className="panel panel-accent">
            <h3>Ensemble code</h3>
            <p className="muted-copy">Share this code with members who need to request access.</p>
            <p className="access-code">{lastAccessCode}</p>
          </article>
        ) : null}

        <div className="ensemble-list">
          {displayedEnsembles.map((ensemble) => (
            <article className="ensemble-row panel" key={ensemble.ensembleId}>
              <div>
                <p className="ensemble-role">Owner: {ensemble.ownerId}</p>
                <h3>{ensemble.name}</h3>
                <p className="ensemble-status">{ensemble.description || "No description yet."}</p>
                <p className="ensemble-role">
                  Sections:{" "}
                  {visibleSections.filter((section) => section.ensembleId === ensemble.ensembleId).length
                    ? visibleSections
                        .filter((section) => section.ensembleId === ensemble.ensembleId)
                        .map((section) => section.name)
                        .join(", ")
                    : "None yet"}
                </p>
              </div>
              <p className="ensemble-role">{ensemble.logoKey ? "Logo uploaded" : "No logo yet"}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section" id="structure">
        <div className="section-header">
          <div>
            <h2>Sections and members</h2>
            <p>
              {isDirectorMode
                ? "Group the ensemble by section and assign people to each group."
                : "See the section you belong to and the other members in that section."}
            </p>
          </div>
          <p className="section-meta">
            Ensemble in focus:{" "}
            {displayedEnsembles.find((ensemble) => ensemble.ensembleId === structureEnsembleId)?.name ||
              "Choose an ensemble"}
          </p>
        </div>

        {isDirectorMode ? (
          <div className="auth-grid">
            <form className="panel form-panel" onSubmit={handleSectionSubmit}>
              <h3>Create section</h3>
              <div className="form-grid">
                <label className="field">
                  <span>Ensemble</span>
                  <select
                    value={structureEnsembleId}
                    onChange={(event) => {
                      setStructureEnsembleId(event.target.value);
                      setMembershipSectionId("");
                    }}
                  >
                    <option value="">Choose ensemble</option>
                    {displayedEnsembles.map((ensemble) => (
                      <option key={ensemble.ensembleId} value={ensemble.ensembleId}>
                        {ensemble.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Section name</span>
                  <input
                    value={sectionName}
                    onChange={(event) => setSectionName(event.target.value)}
                    placeholder="Brass"
                  />
                </label>
              </div>
              <label className="field">
                <span>Description</span>
                <textarea
                  value={sectionDescription}
                  onChange={(event) => setSectionDescription(event.target.value)}
                  placeholder="Short section description"
                  rows={3}
                />
              </label>
              <div className="form-actions">
                <button className="button button-primary" type="submit" disabled={formBusy}>
                  Save section
                </button>
              </div>
            </form>

            <form className="panel form-panel" onSubmit={handleMembershipSubmit}>
              <h3>Assign member</h3>
              <div className="form-grid">
                <label className="field">
                  <span>Member user ID</span>
                  <input
                    value={membershipUserId}
                    onChange={(event) => setMembershipUserId(event.target.value)}
                    placeholder="member-user-id"
                  />
                </label>
                <label className="field">
                  <span>Role</span>
                  <select
                    value={membershipRole}
                    onChange={(event) => setMembershipRole(event.target.value)}
                  >
                    <option value="member">Member</option>
                    <option value="leader">Leader</option>
                    <option value="co_director">Co-director</option>
                    <option value="director">Director</option>
                  </select>
                </label>
              </div>
              <label className="field">
                <span>Section</span>
                <select
                  value={membershipSectionId}
                  onChange={(event) => setMembershipSectionId(event.target.value)}
                >
                  <option value="">No section</option>
                  {activeSections.map((section) => (
                    <option key={section.sectionId} value={section.sectionId}>
                      {section.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-actions">
                <button className="button button-primary" type="submit" disabled={formBusy}>
                  Save membership
                </button>
              </div>
            </form>
          </div>
        ) : (
          <article className="panel">
            <h3>Your section</h3>
            <p className="muted-copy">Your director places you in a section after approval.</p>
          </article>
        )}

        <div className="card-grid dashboard-grid">
          {activeSections.length ? (
            activeSections.map((section) => (
              <article className="panel" key={section.sectionId}>
                <h3>{section.name}</h3>
                <p>{section.description || "No description yet."}</p>
                <p className="ensemble-role">Section ID: {section.sectionId}</p>
              </article>
            ))
          ) : (
            <article className="panel">
              <h3>No sections yet</h3>
              <p>Create the first section for the selected ensemble.</p>
            </article>
          )}
        </div>

        <div className="ensemble-list">
          {activeMemberships.length ? (
            activeMemberships.map((membership) => (
              <article className="ensemble-row panel" key={`${membership.userId}-${membership.ensembleId}`}>
                <div>
                  <p className="ensemble-role">User: {membership.userId}</p>
                  <h3>{membership.sectionName || "Unassigned"}</h3>
                  <p className="ensemble-status">Role: {membership.role}</p>
                </div>
                <div>
                  <p className="ensemble-role">
                    Joined {membership.joinedAt ? new Date(membership.joinedAt).toLocaleDateString() : "unknown"}
                  </p>
                  {isDirectorMode ? (
                    <div className="form-actions">
                      <button
                        className="button button-secondary"
                        type="button"
                        onClick={() => handleRemoveMember(membership.userId, membership.ensembleId)}
                      >
                        Remove from ensemble
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            ))
          ) : (
            <article className="panel">
              <h3>No memberships yet</h3>
              <p>Add people to the selected ensemble to see their assignments here.</p>
            </article>
          )}
        </div>

        {isDirectorMode ? (
          <div className="section">
            <div className="section-header">
              <div>
                <h3>Join requests</h3>
                <p>Approve or hold requests from people who entered the ensemble code.</p>
              </div>
            </div>

            <div className="ensemble-list">
              {remoteJoinRequests.length ? (
                remoteJoinRequests.map((request) => (
                  <article className="ensemble-row panel" key={request.inviteCode}>
                    <div>
                      <p className="ensemble-role">{request.inviteeEmail || request.inviteeUserId}</p>
                      <h3>{request.role}</h3>
                      <p className="ensemble-status">
                        {request.sectionName || "No section yet"} | {request.status}
                      </p>
                    </div>
                    <div className="form-actions">
                      <button
                        className="button button-primary"
                        type="button"
                        onClick={() => handleApproveRequest(request.inviteCode)}
                      >
                        Approve
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <article className="panel">
                  <h3>No pending requests</h3>
                  <p>New requests will appear here after someone uses the ensemble code.</p>
                </article>
              )}
            </div>
          </div>
        ) : null}
      </section>

      <section className="section" id="assignments">
        <div className="section-header">
          <div>
            <h2>{isDirectorMode ? "Assignments" : "My assignments"}</h2>
            <p>
              {isDirectorMode
                ? "Create practice tasks for a specific ensemble and due date."
                : "See the practice tasks assigned to your ensembles."}
            </p>
          </div>
        </div>

        {isDirectorMode ? (
          <form className="panel form-panel" onSubmit={handleAssignmentSubmit}>
            <div className="form-grid">
              <label className="field">
                <span>Ensemble</span>
                <select
                  value={assignmentEnsembleId}
                  onChange={(event) => setAssignmentEnsembleId(event.target.value)}
                >
                  <option value="">Choose ensemble</option>
                  {displayedEnsembles.map((ensemble) => (
                    <option key={ensemble.ensembleId} value={ensemble.ensembleId}>
                      {ensemble.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Due date</span>
                <input
                  type="date"
                  value={assignmentDueDate}
                  onChange={(event) => setAssignmentDueDate(event.target.value)}
                />
              </label>
            </div>
            <label className="field">
              <span>Title</span>
              <input
                value={assignmentTitle}
                onChange={(event) => setAssignmentTitle(event.target.value)}
                placeholder="Rehearse measure 12-28"
              />
            </label>
            <label className="field">
              <span>Description</span>
              <textarea
                value={assignmentDescription}
                onChange={(event) => setAssignmentDescription(event.target.value)}
                placeholder="What members should practice"
                rows={3}
              />
            </label>
            <div className="form-actions">
              <button className="button button-primary" type="submit" disabled={formBusy}>
                Save assignment
              </button>
            </div>
          </form>
        ) : (
          <article className="panel">
            <h3>Assigned to you</h3>
            <p className="muted-copy">Use your section feed to see what needs practice next.</p>
          </article>
        )}

        <div className="ensemble-list">
          {visibleAssignments.map((assignment) => (
            <article className="ensemble-row panel" key={assignment.assignmentId}>
              <div>
                <p className="ensemble-role">Ensemble ID: {assignment.ensembleId}</p>
                <h3>{assignment.title}</h3>
                <p className="ensemble-status">{assignment.description || "No description yet."}</p>
              </div>
              <p className="ensemble-role">Due {assignment.dueDate || "unspecified"}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section" id="submissions">
        <div className="section-header">
          <div>
            <h2>{isDirectorMode ? "Submissions" : "My submissions"}</h2>
            <p>
              {isDirectorMode
                ? "Upload a practice video and browse the current ensemble feed."
                : "Upload your practice video and browse the section feed."}
            </p>
          </div>
        </div>

        <form className="panel form-panel" onSubmit={handleSubmissionSubmit}>
          <div className="form-grid">
            <label className="field">
              <span>Assignment</span>
              <select
                value={submissionAssignmentId}
                onChange={(event) => setSubmissionAssignmentId(event.target.value)}
              >
                <option value="">Choose assignment</option>
                {visibleAssignments.map((assignment) => (
                  <option key={assignment.assignmentId} value={assignment.assignmentId}>
                    {assignment.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Video file</span>
              <input
                type="file"
                accept="video/*"
                onChange={(event) => setSubmissionFile(event.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <label className="field">
            <span>Notes</span>
            <textarea
              value={submissionNotes}
              onChange={(event) => setSubmissionNotes(event.target.value)}
              placeholder="What you practiced and anything to review"
              rows={3}
            />
          </label>
          <div className="form-actions">
            <button className="button button-primary" type="submit" disabled={formBusy}>
              Save submission
            </button>
          </div>
        </form>

        <div className="ensemble-list">
          {visibleSubmissions.map((submission) => (
            <article className="ensemble-row panel" key={submission.submissionId}>
              <div>
                <p className="ensemble-role">Assignment: {submission.assignmentId}</p>
                <h3>{submission.reviewStatus}</h3>
                <p className="ensemble-status">{submission.notes || "No notes yet."}</p>
                <p className="ensemble-role">
                  Section: {submission.sectionId || "unassigned"} | Ensemble: {submission.ensembleId || "unknown"}
                </p>
              </div>
              <div>
                <p className="ensemble-role">{submission.videoKey ? "Video uploaded" : "No video yet"}</p>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => {
                    setCommentSubmissionId(submission.submissionId);
                    setReviewSubmissionId(submission.submissionId);
                  }}
                >
                  View thread
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section" id="thread">
        <div className="section-header">
          <div>
            <h2>Submission thread</h2>
            <p>Read comments on the selected submission and reply back to the section.</p>
          </div>
          <p className="section-meta">
            Selected: {selectedSubmission ? selectedSubmission.submissionId : "Choose a submission"}
          </p>
        </div>

        <div className="auth-grid">
          <article className="panel form-panel">
            <h3>Thread preview</h3>
            {selectedSubmission ? (
              <>
                <p className="muted-copy">Assignment: {selectedSubmission.assignmentId}</p>
                <p className="muted-copy">Section: {selectedSubmission.sectionId || "unassigned"}</p>
                <p>{selectedSubmission.notes || "No submission notes yet."}</p>
              </>
            ) : (
              <p>No submission selected yet.</p>
            )}
          </article>

          <form className="panel form-panel" onSubmit={handleCommentSubmit}>
            <h3>Add comment</h3>
            <label className="field">
              <span>Submission</span>
              <select
                value={commentSubmissionId}
                onChange={(event) => setCommentSubmissionId(event.target.value)}
              >
                <option value="">Choose submission</option>
                {visibleSubmissions.map((submission) => (
                  <option key={submission.submissionId} value={submission.submissionId}>
                    {submission.submissionId}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Comment</span>
              <textarea
                value={commentBody}
                onChange={(event) => setCommentBody(event.target.value)}
                placeholder="Leave a note for the section"
                rows={4}
              />
            </label>
            <div className="form-actions">
              <button className="button button-primary" type="submit" disabled={formBusy}>
                Save comment
              </button>
            </div>
          </form>
        </div>

        <div className="ensemble-list">
          {visibleComments.length ? (
            visibleComments.map((comment) => (
              <article className="ensemble-row panel" key={comment.commentId}>
                <div>
                  <p className="ensemble-role">Author: {comment.authorId}</p>
                  <h3>{comment.body}</h3>
                </div>
                <p className="ensemble-role">
                  {comment.createdAt ? new Date(comment.createdAt).toLocaleString() : "Unknown"}
                </p>
              </article>
            ))
          ) : (
            <article className="panel">
              <h3>No comments yet</h3>
              <p>Choose a submission and start the thread.</p>
            </article>
          )}
        </div>
      </section>

      <section className="section" id="notifications">
        <div className="section-header">
          <div>
            <h2>Notifications</h2>
            <p>New submissions, comments, and feedback show up here.</p>
          </div>
          <p className="section-meta">Unread: {unreadNotificationCount}</p>
        </div>

        <div className="ensemble-list">
          {visibleNotifications.length ? (
            visibleNotifications.map((notification) => (
              <article className="ensemble-row panel" key={notification.notificationId}>
                <div>
                  <p className="ensemble-role">{notification.type}</p>
                  <h3>{notification.message}</h3>
                  <p className="ensemble-status">{notification.isRead ? "Read" : "Unread"}</p>
                </div>
                <div className="form-actions">
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={async () => {
                      await markNotificationRead(accessToken, notification.notificationId);
                      setRemoteNotifications((current) =>
                        current.map((item) =>
                          item.notificationId === notification.notificationId
                            ? { ...item, isRead: true }
                            : item,
                        ),
                      );
                      setFormMessage("Notification marked as read.");
                    }}
                    disabled={notification.isRead}
                  >
                    Mark read
                  </button>
                </div>
              </article>
            ))
          ) : (
            <article className="panel">
              <h3>No notifications yet</h3>
              <p>New activity will appear here once the ensemble starts using the workflow.</p>
            </article>
          )}
        </div>
      </section>

      <section className="section" id="feedback">
        <div className="section-header">
          <div>
            <h2>Feedback</h2>
            <p>
              {isDirectorMode
                ? "Review a submission and add feedback for the member."
                : "Read feedback left on your submissions."}
            </p>
          </div>
        </div>

        {isDirectorMode ? (
          <form className="panel form-panel" onSubmit={handleReviewSubmit}>
            <div className="form-grid">
              <label className="field">
                <span>Submission</span>
                <select
                  value={reviewSubmissionId}
                  onChange={(event) => setReviewSubmissionId(event.target.value)}
                >
                  <option value="">Choose submission</option>
                  {visibleSubmissions.map((submission) => (
                    <option key={submission.submissionId} value={submission.submissionId}>
                      {submission.submissionId}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Status</span>
                <select
                  value={reviewStatus}
                  onChange={(event) => setReviewStatus(event.target.value)}
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="needs_work">Needs work</option>
                </select>
              </label>
            </div>
            <label className="field">
              <span>Feedback</span>
              <textarea
                value={reviewFeedback}
                onChange={(event) => setReviewFeedback(event.target.value)}
                placeholder="Add comments for the member"
                rows={3}
              />
            </label>
            <div className="form-actions">
              <button className="button button-primary" type="submit" disabled={formBusy}>
                Save feedback
              </button>
            </div>
          </form>
        ) : (
          <article className="panel">
            <h3>Latest feedback</h3>
            {selectedSubmission ? (
              <>
                <p className="muted-copy">Submission: {selectedSubmission.submissionId}</p>
                <p>{selectedSubmission.feedback || "No feedback yet."}</p>
                <p className="muted-copy">Status: {selectedSubmission.reviewStatus}</p>
              </>
            ) : (
              <p>No submission selected yet.</p>
            )}
          </article>
        )}
      </section>

      <section className="section" id="media">
        <div className="section-header">
          <div>
            <h2>Media</h2>
            <p>Practice videos and other files go through the app.</p>
          </div>
        </div>

        <form className="panel form-panel" onSubmit={handleUploadSubmit}>
          <div className="form-grid">
            <label className="field">
              <span>File</span>
              <input
                type="file"
                onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <label className="field">
              <span>Ensemble ID</span>
              <input
                value={uploadEnsembleId}
                onChange={(event) => setUploadEnsembleId(event.target.value)}
                placeholder="Optional ensemble ID"
              />
            </label>
          </div>
          <div className="form-actions">
            <button className="button button-primary" type="submit" disabled={formBusy}>
              Upload file
            </button>
          </div>
        </form>
      </section>

      {profileModalOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setProfileModalOpen(false)}
        >
          <form
            className="panel form-panel modal-panel"
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleProfileSubmit}
          >
            <div className="section-header">
              <div>
                <h2>Edit profile photo</h2>
                <p>Update your name and upload a new profile photo.</p>
              </div>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setProfileModalOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="profile-hero">
              <div className="avatar-circle avatar-circle-large" aria-hidden="true">
                {avatarInitials}
              </div>
              <div>
                <h3>{signedInName}</h3>
                <p className="muted-copy">{signedInEmail || "Your email comes from sign-in."}</p>
              </div>
            </div>

            <label className="field">
              <span>Display name</span>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Musician name"
              />
            </label>

            <label className="field">
              <span>Profile photo</span>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => setProfilePhotoFile(event.target.files?.[0] ?? null)}
              />
            </label>

            <p className="muted-copy">Your email stays tied to your sign-in account.</p>

            <div className="form-actions">
              <button className="button button-primary" type="submit" disabled={formBusy}>
                Save profile
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <section className="section">
        <div className="panel panel-accent">
          <h2>Recent activity</h2>
          <p>{formMessage || "Ready."}</p>
        </div>
      </section>

      {toastMessage ? (
        <div className={`toast toast-${toastKind}`} role="status" aria-live="polite">
          {toastMessage}
        </div>
      ) : null}

      </div>
    </main>
  );
}

export default App;
