import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  apiUrl,
  createAssignment,
  createAnnouncement,
  createComment,
  createConversation,
  createMessage,
  createMembership,
  createEnsemble,
  getEnsemble,
  createSection,
  createSubmission,
  createUploadPresign,
  getUploadUrl,
  approveJoinRequest,
  fetchHealthSignal,
  getCurrentProfile,
  listAssignmentsForEnsemble,
  listComments,
  listConversations,
  listMemberships,
  listEnsembles,
  listJoinRequests,
  listSections,
  listMessages,
  listSubmissionsWithScope,
  listNotifications,
  markNotificationRead,
  removeMembership,
  updateMembership,
  updateEnsemble,
  requestJoin,
  updateSubmission,
  upsertProfile,
} from "./lib/api";
import {
  beginCognitoSignIn,
  buildCognitoLogoutUrl,
  clearSession,
  clearRequestedPortal,
  cognitoClientId,
  cognitoDomain,
  cognitoLogoutUri,
  cognitoRedirectUri,
  loadRequestedPortal,
  getAuthStatusText,
  handleCognitoCallback,
  loadStoredSession,
  saveRequestedPortal,
  type AuthSession,
} from "./lib/auth";
import ensembleFlowLogo from "./assets/ensembleflow-logo.svg";

const placeholderProfile = {
  userId: "",
  email: "",
  username: "",
  displayName: "Musician",
  photoKey: "",
};

const localDirectorEmail =
  typeof import.meta.env.VITE_DIRECTOR_EMAIL === "string"
    ? import.meta.env.VITE_DIRECTOR_EMAIL.trim().toLowerCase()
    : "";

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

function getMemberDisplayName(member: { userId: string; username?: string; displayName?: string }) {
  const displayName = member.displayName?.trim();
  if (displayName) {
    return displayName;
  }

  const username = member.username?.trim();
  if (username) {
    return `@${username}`;
  }

  return `Member ${member.userId.slice(0, 8)}`;
}

function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "brand-logo brand-logo-compact" : "brand-logo"}>
      <img src={ensembleFlowLogo} alt="EnsembleFlow" />
    </div>
  );
}

function App() {
  const [apiState, setApiState] = useState("Checking backend connection...");
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [portalMode, setPortalMode] = useState<"director" | "member">("member");
  const [isDirectorAccount, setIsDirectorAccount] = useState(false);
  const [directorView, setDirectorView] = useState<
    "home" | "ensemble" | "sections" | "section" | "assignments" | "assignment" | "announcements"
  >("home");
  const [memberView, setMemberView] = useState<
    "home" | "ensemble" | "announcements" | "section" | "messages" | "assignments"
  >("home");
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
  const [profileUsername, setProfileUsername] = useState("");
  const [remoteEnsembles, setRemoteEnsembles] = useState<Array<{
    ensembleId: string;
    ownerId: string;
    name: string;
    description: string;
    logoKey: string;
    accessCode?: string;
  }>>([]);
  const [ensembleLogoUrls, setEnsembleLogoUrls] = useState<Record<string, string>>({});
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
    username: string;
    displayName: string;
    role: string;
    status: string;
    sectionId: string;
    sectionName: string;
    joinedAt: string;
    updatedAt: string;
  }>>([]);
  const [remoteAssignments, setRemoteAssignments] = useState<Array<{
    assignmentId: string;
    ownerId: string;
    ensembleId: string;
    sectionId: string;
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
  const [remoteConversations, setRemoteConversations] = useState<Array<{
    conversationId: string;
    ensembleId: string;
    sectionId: string;
    title: string;
    createdBy: string;
    participantIds: string[];
    createdAt: string;
    updatedAt: string;
  }>>([]);
  const [remoteConversationMessages, setRemoteConversationMessages] = useState<Array<{
    conversationId: string;
    messageId: string;
    senderId: string;
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
  const [username, setUsername] = useState("");
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [ensembleName, setEnsembleName] = useState("New ensemble");
  const [ensembleDescription, setEnsembleDescription] = useState("");
  const [ensembleLogoFile, setEnsembleLogoFile] = useState<File | null>(null);
  const [selectedEnsembleLogoFile, setSelectedEnsembleLogoFile] = useState<File | null>(null);
  const [selectedEnsembleDetails, setSelectedEnsembleDetails] = useState<{
    ensembleId: string;
    ownerId: string;
    name: string;
    description: string;
    logoKey: string;
    accessCode?: string;
  } | null>(null);
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
  const [assignmentSectionId, setAssignmentSectionId] = useState("");
  const [selectedDirectorSectionId, setSelectedDirectorSectionId] = useState("");
  const [selectedDirectorAssignmentId, setSelectedDirectorAssignmentId] = useState("");
  const [submissionAssignmentId, setSubmissionAssignmentId] = useState("");
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [reviewSubmissionId, setReviewSubmissionId] = useState("");
  const [reviewStatus, setReviewStatus] = useState("approved");
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [sectionMessageConversationId, setSectionMessageConversationId] = useState("");
  const [sectionMessageTitle, setSectionMessageTitle] = useState("");
  const [sectionMessageBody, setSectionMessageBody] = useState("");
  const [selectedMemberSectionId, setSelectedMemberSectionId] = useState("");
  const [selectedDirectorMemberId, setSelectedDirectorMemberId] = useState("");
  const [directorMemberMessage, setDirectorMemberMessage] = useState("");
  const [conversationParticipantIds, setConversationParticipantIds] = useState<string[]>([]);
  const [announcementBody, setAnnouncementBody] = useState("");
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
        setAccessToken(stored.idToken || stored.accessToken);
        setAuthMessage(getAuthStatusText(stored));
      }

      try {
        const session = await handleCognitoCallback();
        if (!cancelled && session) {
          setAuthSession(session);
          setAccessToken(session.idToken || session.accessToken);
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
        setProfileUsername("");
          setRemoteEnsembles([]);
          setSelectedEnsembleDetails(null);
        setRemoteSections([]);
        setRemoteMemberships([]);
        setRemoteAssignments([]);
        setRemoteSubmissions([]);
        setRemoteComments([]);
        setRemoteConversations([]);
        setRemoteConversationMessages([]);
        setRemoteNotifications([]);
        setRemoteJoinRequests([]);
        setLastAccessCode("");
        setStructureEnsembleId("");
        setCommentSubmissionId("");
        setSectionMessageConversationId("");
        setSectionMessageTitle("");
        setSectionMessageBody("");
        setSelectedMemberSectionId("");
        setConversationParticipantIds([]);
        return;
      }

      setProfile({
        userId: "",
        email: "",
        username: "",
        displayName: "",
        photoKey: "",
      });
      setDisplayName("");
      setUsername("");

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
          setProfileUsername(profileResponse.profile.username || "");
          setUsername(profileResponse.profile.username || "");
        } else {
          const claimedEmail = sessionClaims.email || "";
          const fallbackUsername = claimedEmail ? claimedEmail.split("@")[0] : "";
          setProfileUsername(fallbackUsername);
          setUsername(fallbackUsername);
        }

        const requestedPortal = loadRequestedPortal();
        const localDirectorMatch = Boolean(
          localDirectorEmail && (sessionClaims.email || "").trim().toLowerCase() === localDirectorEmail,
        );
        setIsDirectorAccount(Boolean(profileResponse.isDirectorAccount || localDirectorMatch));
        if (requestedPortal === "director" && !(profileResponse.isDirectorAccount || localDirectorMatch)) {
          setPortalMode("member");
          setAuthMessage("This email is not approved for director access.");
          setFormMessage("Director access is limited to approved email addresses.");
        } else {
          setPortalMode(requestedPortal);
          setAuthMessage("Signed in.");
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

    async function loadSelectedEnsembleDetails() {
      if (!accessToken || portalMode !== "director" || !structureEnsembleId) {
        setSelectedEnsembleDetails(null);
        return;
      }

      try {
        const response = await getEnsemble(accessToken, structureEnsembleId);
        if (!cancelled) {
          setSelectedEnsembleDetails(response.ensemble);
        }
      } catch {
        if (!cancelled) {
          setSelectedEnsembleDetails(null);
        }
      }
    }

    void loadSelectedEnsembleDetails();

    return () => {
      cancelled = true;
    };
  }, [accessToken, portalMode, structureEnsembleId]);

  useEffect(() => {
    let cancelled = false;

    async function loadEnsembleLogos() {
      if (!accessToken || !remoteEnsembles.length) {
        setEnsembleLogoUrls({});
        return;
      }

      const nextLogoUrls: Record<string, string> = {};

      await Promise.all(
        remoteEnsembles.map(async (ensemble) => {
          if (!ensemble.logoKey) {
            return;
          }

          try {
            const result = await getUploadUrl(accessToken, ensemble.logoKey);
            if (!cancelled) {
              nextLogoUrls[ensemble.ensembleId] = result.url;
            }
          } catch {
            // Skip logos that fail to resolve.
          }
        }),
      );

      if (!cancelled) {
        setEnsembleLogoUrls(nextLogoUrls);
      }
    }

    void loadEnsembleLogos();

    return () => {
      cancelled = true;
    };
  }, [accessToken, remoteEnsembles]);

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
          setRemoteJoinRequests(response.invitations.filter((invitation) => invitation.status === "pending"));
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

  const displayedEnsembles = remoteEnsembles;
  const visibleSections = remoteSections;
  const visibleMemberships = remoteMemberships;
  const activeSections = visibleSections.filter(
    (section) => section.ensembleId === structureEnsembleId,
  );
  const activeMemberships = visibleMemberships.filter(
    (membership) => membership.ensembleId === structureEnsembleId,
  );
  const approvedMemberships = activeMemberships.filter(
    (membership) => membership.status !== "blocked" && membership.status !== "removed",
  );
  const visibleAssignments = remoteAssignments;
  const visibleSubmissions = remoteSubmissions;
  const visibleComments = remoteComments;
  const visibleNotifications = remoteNotifications;
  const directorAnnouncements = visibleNotifications.filter(
    (notification) =>
      notification.type === "announcement" &&
      (!structureEnsembleId || notification.entityId === structureEnsembleId),
  );
  const latestMemberAnnouncement = directorAnnouncements[0] || null;
  const sessionClaims = useMemo(() => decodeJwtPayload(authSession?.idToken), [authSession?.idToken]);
  const signedInName = accessToken
    ? (profile.displayName.trim() &&
        profile.displayName !== placeholderProfile.displayName
          ? profile.displayName.trim()
          : sessionClaims.name || sessionClaims.email || "Musician")
    : placeholderProfile.displayName;
  const signedInEmail = accessToken ? (sessionClaims.email || "") : placeholderProfile.email;
  const signedInUsername = accessToken
    ? (profile.username.trim() || profileUsername.trim() || sessionClaims["preferred_username"] || "")
    : "";
  const signedInEmailNormalized = signedInEmail.trim().toLowerCase();
  const avatarInitials = getInitials(signedInName);
  const getMemberNameById = (userId: string) => {
    if (userId === profile.userId) {
      return signedInName;
    }

    const membership = activeMemberships.find((item) => item.userId === userId);
    return membership ? getMemberDisplayName(membership) : `Member ${userId.slice(0, 8)}`;
  };
  const selectedSubmission =
    visibleSubmissions.find((submission) => submission.submissionId === commentSubmissionId) ||
    visibleSubmissions[0] ||
    null;
  const selectedDirectorEnsemble =
    displayedEnsembles.find((ensemble) => ensemble.ensembleId === structureEnsembleId) || null;
  const selectedDirectorSection =
    visibleSections.find((section) => section.sectionId === selectedDirectorSectionId) || null;
  const selectedDirectorSectionMemberships = selectedDirectorSection
    ? activeMemberships.filter((membership) => membership.sectionId === selectedDirectorSection.sectionId)
    : [];
  const selectedDirectorMember =
    activeMemberships.find((membership) => membership.userId === selectedDirectorMemberId) || null;
  const selectedDirectorAssignment =
    visibleAssignments.find((assignment) => assignment.assignmentId === selectedDirectorAssignmentId) || null;
  const selectedSectionAssignments = selectedDirectorSection
    ? visibleAssignments.filter(
        (assignment) =>
          assignment.ensembleId === selectedDirectorSection?.ensembleId &&
          (!assignment.sectionId || assignment.sectionId === selectedDirectorSection.sectionId),
      )
    : [];
  const selectedSectionSubmissions = selectedDirectorSection
    ? remoteSubmissions.filter((submission) => submission.sectionId === selectedDirectorSection.sectionId)
    : [];
  const selectedAssignmentSubmissions = selectedDirectorAssignment
    ? remoteSubmissions.filter(
        (submission) => submission.assignmentId === selectedDirectorAssignment.assignmentId,
      )
    : [];
  const selectedDirectorMemberAssignments = selectedDirectorMember
    ? visibleAssignments.filter(
        (assignment) =>
          assignment.ensembleId === selectedDirectorMember.ensembleId &&
          (!assignment.sectionId || assignment.sectionId === selectedDirectorMember.sectionId),
      )
    : [];
  const selectedDirectorMemberSubmissions = selectedDirectorMember
    ? remoteSubmissions.filter(
        (submission) =>
          submission.ensembleId === selectedDirectorMember.ensembleId &&
          submission.ownerId === selectedDirectorMember.userId,
      )
    : [];
  const selectedDirectorMemberSubmittedAssignmentIds = new Set(
    selectedDirectorMemberSubmissions.map((submission) => submission.assignmentId),
  );
  const selectedDirectorMemberMissingAssignments = selectedDirectorMemberAssignments.filter(
    (assignment) => !selectedDirectorMemberSubmittedAssignmentIds.has(assignment.assignmentId),
  );
  const isDirectorMode =
    portalMode === "director" && (isDirectorAccount || signedInEmailNormalized === localDirectorEmail);
  const selectedMemberAssignments = selectedDirectorEnsemble
    ? visibleAssignments.filter((assignment) => assignment.ensembleId === selectedDirectorEnsemble.ensembleId)
    : [];
  const currentAssignments = isDirectorMode
    ? visibleAssignments
    : selectedMemberAssignments;
  const currentMemberMemberships = !isDirectorMode && selectedDirectorEnsemble
    ? visibleMemberships.filter(
        (membership) =>
          membership.ensembleId === selectedDirectorEnsemble.ensembleId &&
          membership.userId === profile.userId &&
          membership.status !== "blocked",
      )
    : [];
  const currentMemberSectionIds = Array.from(
    new Set(currentMemberMemberships.map((membership) => membership.sectionId).filter(Boolean)),
  );
  const selectedMemberSection =
    currentMemberMemberships.find((membership) => membership.sectionId === selectedMemberSectionId) ||
    currentMemberMemberships[0] ||
    null;
  const currentSectionMemberships = !isDirectorMode && selectedDirectorEnsemble
    ? visibleMemberships.filter(
        (membership) =>
          membership.ensembleId === selectedDirectorEnsemble.ensembleId &&
          membership.sectionId === selectedMemberSection?.sectionId &&
          membership.status !== "blocked",
      )
    : [];
  const currentSectionRoster = currentSectionMemberships.filter((membership) => membership.userId !== profile.userId);
  const currentMemberAssignments = !isDirectorMode && selectedDirectorEnsemble
    ? visibleAssignments.filter(
        (assignment) =>
          assignment.ensembleId === selectedDirectorEnsemble.ensembleId &&
          (!assignment.sectionId || assignment.sectionId === selectedMemberSection?.sectionId),
      )
    : [];
  const memberSubmittedAssignmentIds = new Set(
    visibleSubmissions
      .filter(
        (submission) =>
          submission.ownerId === profile.userId &&
          submission.ensembleId === selectedDirectorEnsemble?.ensembleId,
      )
      .map((submission) => submission.assignmentId),
  );
  const memberOutstandingAssignments = currentMemberAssignments.filter(
    (assignment) => !memberSubmittedAssignmentIds.has(assignment.assignmentId),
  );
  useEffect(() => {
    if (!currentMemberSectionIds.length) {
      return;
    }

    if (!selectedMemberSectionId || !currentMemberSectionIds.includes(selectedMemberSectionId)) {
      setSelectedMemberSectionId(currentMemberSectionIds[0]);
    }
  }, [currentMemberSectionIds, selectedMemberSectionId]);

  useEffect(() => {
    let cancelled = false;

    async function loadConversations() {
      if (!accessToken || !selectedDirectorEnsemble) {
        setRemoteConversations([]);
        return;
      }

      try {
        if (isDirectorMode) {
          const response = await listConversations(accessToken, selectedDirectorEnsemble.ensembleId);

          if (cancelled) return;

          setRemoteConversations(response.conversations);
          if (
            response.conversations.length &&
            !response.conversations.some((conversation) => conversation.conversationId === sectionMessageConversationId)
          ) {
            setSectionMessageConversationId(response.conversations[0].conversationId);
          }
          if (!response.conversations.length) {
            setSectionMessageConversationId("");
            setRemoteConversationMessages([]);
          }
          return;
        }

        if (!selectedMemberSection?.sectionId) {
          setRemoteConversations([]);
          return;
        }

        const response = await listConversations(
          accessToken,
          selectedDirectorEnsemble.ensembleId,
          selectedMemberSection.sectionId,
        );

        if (cancelled) return;

        setRemoteConversations(response.conversations);
        if (
          response.conversations.length &&
          !response.conversations.some((conversation) => conversation.conversationId === sectionMessageConversationId)
        ) {
          setSectionMessageConversationId(response.conversations[0].conversationId);
        }
        if (!response.conversations.length) {
          setSectionMessageConversationId("");
          setRemoteConversationMessages([]);
        }
      } catch (error) {
        if (!cancelled) {
          setFormMessage(error instanceof Error ? error.message : "Could not load conversations.");
        }
      }
    }

    void loadConversations();

    return () => {
      cancelled = true;
    };
  }, [
    accessToken,
    isDirectorMode,
    selectedDirectorEnsemble,
    selectedMemberSection?.sectionId,
    sectionMessageConversationId,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function loadConversationMessages() {
      if (!accessToken || !sectionMessageConversationId) {
        setRemoteConversationMessages([]);
        return;
      }

      try {
        const response = await listMessages(accessToken, sectionMessageConversationId);
        if (!cancelled) {
          setRemoteConversationMessages(response.messages);
        }
      } catch (error) {
        if (!cancelled) {
          setFormMessage(error instanceof Error ? error.message : "Could not load messages.");
        }
      }
    }

    void loadConversationMessages();

    return () => {
      cancelled = true;
    };
  }, [accessToken, sectionMessageConversationId]);

  const showWorkspace = Boolean(accessToken);
  const navigationItems = [
    {
      id: "ensembles",
      label: isDirectorMode ? "Ensembles" : "My ensembles",
    },
  ];

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

  function openProfileEditor() {
    const fallbackUsername =
      profile.username.trim() ||
      profileUsername.trim() ||
      profile.email.trim().split("@")[0] ||
      (signedInEmail ? signedInEmail.split("@")[0] : "");

    setUsername(fallbackUsername);
    setDisplayName(profile.displayName.trim() || signedInName);
    setProfileModalOpen(true);
  }

  async function handlePortalSignIn(mode: "director" | "member") {
    try {
      clearSession();
      setAuthSession(null);
      setAccessToken("");
      setIsDirectorAccount(false);
      setPortalMode(mode);
      saveRequestedPortal(mode);
      await beginCognitoSignIn({ forceLogin: true });
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "Could not start sign-in.");
    }
  }

  function openDirectorHome() {
    setDirectorView("home");
    setStructureEnsembleId("");
    setSelectedDirectorSectionId("");
    setSelectedDirectorAssignmentId("");
    setSelectedDirectorMemberId("");
    setAssignmentSectionId("");
  }

  function openDirectorEnsemble(ensembleId: string) {
    setStructureEnsembleId(ensembleId);
    setAssignmentEnsembleId(ensembleId);
    setAssignmentSectionId("");
    setSelectedDirectorMemberId("");
    setDirectorView("ensemble");
  }

  function openDirectorSections(ensembleId: string) {
    setStructureEnsembleId(ensembleId);
    setSelectedDirectorSectionId("");
    setSelectedDirectorAssignmentId("");
    setDirectorView("sections");
  }

  function openDirectorSection(sectionId: string, ensembleId: string) {
    setStructureEnsembleId(ensembleId);
    setSelectedDirectorSectionId(sectionId);
    setSelectedDirectorAssignmentId("");
    setDirectorView("section");
  }

  function openDirectorAssignments(ensembleId: string) {
    setStructureEnsembleId(ensembleId);
    setAssignmentEnsembleId(ensembleId);
    setAssignmentSectionId("");
    setSelectedDirectorAssignmentId("");
    setDirectorView("assignments");
  }

  function openDirectorAssignment(assignmentId: string, ensembleId: string) {
    const assignment = remoteAssignments.find((item) => item.assignmentId === assignmentId);
    setStructureEnsembleId(ensembleId);
    setAssignmentEnsembleId(ensembleId);
    setAssignmentSectionId(assignment?.sectionId || "");
    setSelectedDirectorAssignmentId(assignmentId);
    const submission = remoteSubmissions.find((item) => item.assignmentId === assignmentId) || null;
    setCommentSubmissionId(submission?.submissionId || "");
    setReviewSubmissionId(submission?.submissionId || "");
    setDirectorView("assignment");
  }

  function openDirectorAnnouncements(ensembleId: string) {
    setStructureEnsembleId(ensembleId);
    setDirectorView("announcements");
  }

  function openMemberEnsemble(ensembleId: string) {
    setStructureEnsembleId(ensembleId);
    setAssignmentEnsembleId(ensembleId);
    setUploadEnsembleId(ensembleId);
    setAssignmentSectionId("");
    setCommentSubmissionId("");
    setSelectedMemberSectionId("");
    setSectionMessageConversationId("");
    setSectionMessageTitle("");
    setSectionMessageBody("");
    setConversationParticipantIds([]);
    setMemberView("ensemble");
    document.getElementById("ensembles")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openMemberHome() {
    setStructureEnsembleId("");
    setAssignmentEnsembleId("");
    setUploadEnsembleId("");
    setAssignmentSectionId("");
    setCommentSubmissionId("");
    setSelectedMemberSectionId("");
    setSectionMessageConversationId("");
    setSectionMessageTitle("");
    setSectionMessageBody("");
    setConversationParticipantIds([]);
    setMemberView("home");
    document.getElementById("ensembles")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openMemberAnnouncements() {
    setMemberView("announcements");
  }

  function openMemberSection() {
    setMemberView("section");
  }

  function openMemberMessages() {
    setMemberView("messages");
  }

  function openMemberAssignments() {
    setMemberView("assignments");
  }

  async function handleSignOut() {
    clearSession();
    clearRequestedPortal();
    setAuthSession(null);
    setAccessToken("");
    setPortalMode("member");
    setIsDirectorAccount(false);
    setDirectorView("home");
    setMemberView("home");
      setTokenDraft("");
    setRemoteEnsembles([]);
    setRemoteSections([]);
    setRemoteMemberships([]);
    setRemoteAssignments([]);
    setRemoteSubmissions([]);
    setRemoteComments([]);
    setRemoteConversations([]);
    setRemoteConversationMessages([]);
    setRemoteNotifications([]);
    setRemoteJoinRequests([]);
    setLastAccessCode("");
    setProfile(placeholderProfile);
    setDisplayName(placeholderProfile.displayName);
    setProfileUsername("");
    setUsername("");
    setStructureEnsembleId("");
      setAssignmentEnsembleId("");
      setAssignmentSectionId("");
    setUploadEnsembleId("");
    setMembershipSectionId("");
    setCommentSubmissionId("");
    setSectionMessageConversationId("");
    setSectionMessageTitle("");
    setSectionMessageBody("");
    setSelectedMemberSectionId("");
    setConversationParticipantIds([]);
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
      const nextUsername =
        username.trim() ||
        profile.username.trim() ||
        profileUsername.trim() ||
        profile.email.trim().split("@")[0] ||
        (signedInEmail ? signedInEmail.split("@")[0] : "");

      if (!nextUsername) {
        setFormMessage("Username is required.");
        setFormBusy(false);
        return;
      }

      let photoKey = profile.photoKey;

      if (profilePhotoFile) {
        photoKey = await uploadFileToS3(profilePhotoFile, "profile-photo");
      }

      const result = await upsertProfile(accessToken, {
        displayName,
        username: nextUsername,
        photoKey,
        email: signedInEmail || profile.email,
      });

      setProfile(result.profile);
      setProfileUsername(result.profile.username);
      setUsername(result.profile.username);
      setFormMessage("Profile saved successfully.");
      setProfilePhotoFile(null);
      setProfileModalOpen(false);
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
      setStructureEnsembleId(result.ensemble.ensembleId);
      setAssignmentEnsembleId(result.ensemble.ensembleId);
      setDirectorView("ensemble");
      setEnsembleName("");
      setEnsembleDescription("");
      setEnsembleLogoFile(null);
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Ensemble save failed.");
    } finally {
      setFormBusy(false);
    }
  }

  async function handleSelectedEnsembleLogoSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDirectorEnsemble) {
      setFormMessage("Choose an ensemble first.");
      return;
    }

    setFormBusy(true);
    setFormMessage("Saving ensemble photo...");

    try {
      let logoKey = selectedDirectorEnsemble.logoKey;

      if (selectedEnsembleLogoFile) {
        logoKey = await uploadFileToS3(selectedEnsembleLogoFile, "ensemble-logo", selectedDirectorEnsemble.ensembleId);
      }

      const result = await updateEnsemble(accessToken, selectedDirectorEnsemble.ensembleId, {
        logoKey,
      });

      setRemoteEnsembles((current) =>
        current.map((ensemble) =>
          ensemble.ensembleId === result.ensemble.ensembleId ? result.ensemble : ensemble,
        ),
      );
      setSelectedEnsembleLogoFile(null);
      setFormMessage("Ensemble photo saved successfully.");
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Ensemble photo save failed.");
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
      setSelectedDirectorSectionId(result.section.sectionId);
      setDirectorView("section");
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
    if (!membershipUserId) {
      setFormMessage("Choose a member first.");
      return;
    }

    setFormBusy(true);
    setFormMessage("Saving member placement...");

    try {
      const section = visibleSections.find((item) => item.sectionId === membershipSectionId);
      const existingMembership = activeMemberships.find(
        (membership) => membership.userId === membershipUserId && membership.ensembleId === structureEnsembleId,
      );
      const payload = {
        role: membershipRole,
        sectionId: membershipSectionId,
        sectionName: section?.name || "",
      };
      const result = existingMembership
        ? await updateMembership(accessToken, existingMembership.userId, existingMembership.ensembleId, payload)
        : await createMembership(accessToken, {
            ensembleId: structureEnsembleId,
            userId: membershipUserId,
            ...payload,
          });

      setRemoteMemberships((current) => {
        const withoutPreviousVersion = current.filter(
          (membership) =>
            !(
              membership.userId === result.membership.userId &&
              membership.ensembleId === result.membership.ensembleId
            ),
        );

        return [result.membership, ...withoutPreviousVersion];
      });
      setFormMessage(existingMembership ? "Member updated." : "Member added.");
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
      if (selectedDirectorMemberId === userId) {
        setSelectedDirectorMemberId("");
      }
      setFormMessage("Member removed.");
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Member removal failed.");
    }
  }

  async function handleBlockMember(userId: string, ensembleId: string) {
    setFormMessage("Blocking member...");
    try {
      const result = await updateMembership(accessToken, userId, ensembleId, {
        status: "blocked",
      });

      setRemoteMemberships((current) =>
        current.map((membership) =>
          membership.userId === userId && membership.ensembleId === ensembleId
            ? result.membership
            : membership,
        ),
      );
      setFormMessage("Member blocked.");
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Member block failed.");
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
        sectionId: assignmentSectionId || undefined,
        title: assignmentTitle,
        description: assignmentDescription,
        dueDate: assignmentDueDate,
      });

      setRemoteAssignments((current) => [result.assignment, ...current]);
      setFormMessage("Assignment saved.");
      setSelectedDirectorAssignmentId(result.assignment.assignmentId);
      setDirectorView("assignment");
      setAssignmentTitle("New assignment");
      setAssignmentDescription("");
      setAssignmentDueDate("");
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Assignment save failed.");
    } finally {
      setFormBusy(false);
    }
  }

  async function handleAnnouncementSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!structureEnsembleId) {
      setFormMessage("Choose an ensemble before posting an announcement.");
      return;
    }

    if (!announcementBody.trim()) {
      setFormMessage("Enter an announcement before posting.");
      return;
    }

    setFormBusy(true);
    setFormMessage("Posting announcement...");

    try {
      const result = await createAnnouncement(accessToken, {
        ensembleId: structureEnsembleId,
        message: announcementBody.trim(),
      });

      setFormMessage(`Announcement posted to ${result.recipientCount} members.`);
      setAnnouncementBody("");
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Announcement failed.");
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

  async function handleConversationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDirectorEnsemble || !selectedMemberSection?.sectionId) {
      setFormMessage("Open an ensemble and choose a section first.");
      return;
    }

    setFormBusy(true);
    setFormMessage("Creating conversation...");

    try {
      const result = await createConversation(accessToken, {
        ensembleId: selectedDirectorEnsemble.ensembleId,
        sectionId: selectedMemberSection.sectionId,
        title: sectionMessageTitle.trim(),
        participantIds: conversationParticipantIds,
      });

      setRemoteConversations((current) => [result.conversation, ...current]);
      setSectionMessageConversationId(result.conversation.conversationId);
      setSectionMessageTitle("");
      setConversationParticipantIds([]);
      setFormMessage("Conversation created.");
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Conversation save failed.");
    } finally {
      setFormBusy(false);
    }
  }

  async function handleMessageSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sectionMessageConversationId) {
      setFormMessage("Choose a conversation first.");
      return;
    }

    if (!sectionMessageBody.trim()) {
      setFormMessage("Enter a message first.");
      return;
    }

    setFormBusy(true);
    setFormMessage("Sending message...");

    try {
      const result = await createMessage(accessToken, {
        conversationId: sectionMessageConversationId,
        body: sectionMessageBody.trim(),
      });

      setRemoteConversationMessages((current) => [...current, result.message]);
      setSectionMessageBody("");
      setFormMessage("Message sent.");
      await reloadNotifications();
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Message save failed.");
    } finally {
      setFormBusy(false);
    }
  }

  async function handleDirectorMemberMessageSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDirectorEnsemble || !selectedDirectorMember) {
      setFormMessage("Choose a member before sending a message.");
      return;
    }

    if (!selectedDirectorMember.sectionId) {
      setFormMessage("Place this member in a section before starting a message.");
      return;
    }

    if (!directorMemberMessage.trim()) {
      setFormMessage("Enter a message first.");
      return;
    }

    setFormBusy(true);
    setFormMessage("Sending message...");

    try {
      const result = await createConversation(accessToken, {
        ensembleId: selectedDirectorEnsemble.ensembleId,
        sectionId: selectedDirectorMember.sectionId,
        title: `Message with ${getMemberDisplayName(selectedDirectorMember)}`,
        participantIds: [selectedDirectorMember.userId],
      });

      const messageResult = await createMessage(accessToken, {
        conversationId: result.conversation.conversationId,
        body: directorMemberMessage.trim(),
      });

      setRemoteConversations((current) => [result.conversation, ...current]);
      setRemoteConversationMessages((current) => [...current, messageResult.message]);
      setSectionMessageConversationId(result.conversation.conversationId);
      setDirectorMemberMessage("");
      setFormMessage("Message sent.");
      await reloadNotifications();
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Message send failed.");
    } finally {
      setFormBusy(false);
    }
  }

  if (isDirectorMode) {
    return (
      <main className="app-shell">
        <aside className="sidebar panel">
          <div>
            <BrandLogo compact />
            <h2>Director dashboard</h2>
            <p className="muted-copy">Manage ensembles, sections, assignments, and announcements.</p>
          </div>

          <div className="sidebar-actions">
            <button
              className="button button-secondary"
              type="button"
              onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            >
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
            <button className="button button-primary" type="button" onClick={openDirectorHome}>
              Home
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => selectedDirectorEnsemble && openDirectorEnsemble(selectedDirectorEnsemble.ensembleId)}
            >
              Ensembles
            </button>
          </div>
        </aside>

        <div className="workspace">
          <section className="hero" id="overview">
            <div className="hero-topline">
              <BrandLogo compact />
            </div>
            <div className="hero-grid hero-grid-main">
              <div>
                <h1>Manage the ensemble from one place.</h1>
                <p className="lede">
                  Create ensembles, open sections, add assignments, and post announcements without mixing in member tools.
                </p>
              </div>

              <article className="panel panel-accent">
                <h2>Current focus</h2>
                <p>
                  {selectedDirectorEnsemble
                    ? `${selectedDirectorEnsemble.name} is selected.`
                    : "Create an ensemble or open an existing one to manage it."}
                </p>
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
                  <p className="muted-copy">{signedInEmail || "Your email comes from sign-in."}</p>
                  {signedInUsername ? <p className="muted-copy">@{signedInUsername}</p> : null}
                </div>
                <div className="account-actions">
                  <button className="button button-primary" type="button" onClick={openProfileEditor}>
                    Edit profile photo
                  </button>
                  <button className="button button-secondary" type="button" onClick={handleSignOut}>
                    Sign out
                  </button>
                </div>
              </article>
            </div>
          </section>

          <section className="section">
            <div className="section-header">
              <div>
                <h2>{directorView === "home" ? "Ensembles" : selectedDirectorEnsemble?.name || "Ensemble"}</h2>
                <p>
                  {directorView === "home"
                    ? "Create a new ensemble or open an existing one."
                    : "Use page buttons to move between sections, assignments, and announcements."}
                </p>
              </div>
              <div className="form-actions">
                {directorView !== "home" ? (
                  <button className="button button-secondary" type="button" onClick={openDirectorHome}>
                    Back home
                  </button>
                ) : null}
              </div>
            </div>

            {directorView === "home" ? (
              <>
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
                      Add ensemble
                    </button>
                  </div>
                </form>

                <div className="ensemble-list">
                  {displayedEnsembles.length ? (
                    displayedEnsembles.map((ensemble) => (
                      <article className="ensemble-row panel" key={ensemble.ensembleId}>
                        <div>
                          <p className="ensemble-role">Owner: {ensemble.ownerId}</p>
                          <h3>{ensemble.name}</h3>
                          <p className="ensemble-status">{ensemble.description || "No description yet."}</p>
                          {ensembleLogoUrls[ensemble.ensembleId] ? (
                            <img
                              className="ensemble-logo-preview"
                              src={ensembleLogoUrls[ensemble.ensembleId]}
                              alt={`${ensemble.name} logo`}
                            />
                          ) : null}
                        </div>
                        <div className="form-actions">
                          <button
                            className="button button-primary"
                            type="button"
                            onClick={() => openDirectorEnsemble(ensemble.ensembleId)}
                          >
                            Open ensemble
                          </button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <article className="panel">
                      <h3>No ensembles yet</h3>
                      <p>Create the first ensemble to start organizing sections and assignments.</p>
                    </article>
                  )}
                </div>
              </>
            ) : null}

            {directorView === "ensemble" && selectedDirectorEnsemble ? (
              <div className="panel form-panel">
                <div className="section-header">
                  <div>
                    <h3>{selectedDirectorEnsemble.name}</h3>
                    <p>{selectedDirectorEnsemble.description || "No description yet."}</p>
                    <p className="muted-copy">
                      Ensemble code:{" "}
                      {selectedEnsembleDetails?.accessCode || selectedDirectorEnsemble.accessCode || lastAccessCode || "Loading..."}
                    </p>
                  </div>
                  <div className="form-actions">
                    <button className="button button-secondary" type="button" onClick={openDirectorHome}>
                      Home
                    </button>
                  </div>
                </div>

                <div className="card-grid dashboard-grid">
                  <form className="panel form-panel" onSubmit={handleSelectedEnsembleLogoSubmit}>
                    <h3>Ensemble photo</h3>
                    {ensembleLogoUrls[selectedDirectorEnsemble.ensembleId] ? (
                      <img
                        className="ensemble-logo-preview"
                        src={ensembleLogoUrls[selectedDirectorEnsemble.ensembleId]}
                        alt={`${selectedDirectorEnsemble.name} logo`}
                      />
                    ) : (
                      <p className="muted-copy">No photo uploaded yet.</p>
                    )}
                    <label className="field">
                      <span>Upload photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => setSelectedEnsembleLogoFile(event.target.files?.[0] ?? null)}
                      />
                    </label>
                    <div className="form-actions">
                      <button className="button button-primary" type="submit" disabled={formBusy}>
                        Save photo
                      </button>
                    </div>
                  </form>

                  <article className="panel">
                    <h3>Sections</h3>
                    <p>{visibleSections.filter((section) => section.ensembleId === selectedDirectorEnsemble.ensembleId).length} sections</p>
                    <button className="button button-primary" type="button" onClick={() => openDirectorSections(selectedDirectorEnsemble.ensembleId)}>
                      Open sections
                    </button>
                  </article>
                  <article className="panel">
                    <h3>Assignments</h3>
                    <p>{visibleAssignments.filter((assignment) => assignment.ensembleId === selectedDirectorEnsemble.ensembleId).length} assignments</p>
                    <button className="button button-primary" type="button" onClick={() => openDirectorAssignments(selectedDirectorEnsemble.ensembleId)}>
                      Open assignments
                    </button>
                  </article>
                  <article className="panel">
                    <h3>Announcements</h3>
                    <p>Post updates to the whole ensemble inbox.</p>
                    <button className="button button-primary" type="button" onClick={() => openDirectorAnnouncements(selectedDirectorEnsemble.ensembleId)}>
                      Open announcements
                    </button>
                  </article>
                </div>

                <div className="auth-grid">
                  <form className="panel form-panel" onSubmit={handleMembershipSubmit}>
                    <h3>Place member in section</h3>
                    <p className="muted-copy">Approved ensemble members can be assigned to a section from here.</p>
                    <div className="form-grid">
                      <label className="field">
                        <span>Member</span>
                        <select value={membershipUserId} onChange={(event) => setMembershipUserId(event.target.value)}>
                          <option value="">Choose member</option>
                          {approvedMemberships.map((membership) => (
                            <option key={`${membership.userId}-${membership.ensembleId}`} value={membership.userId}>
                              {getMemberDisplayName(membership)} {membership.sectionName ? `(${membership.sectionName})` : "(unassigned)"}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span>Role</span>
                        <select value={membershipRole} onChange={(event) => setMembershipRole(event.target.value)}>
                          <option value="member">Member</option>
                          <option value="leader">Leader</option>
                          <option value="co_director">Co-director</option>
                        </select>
                      </label>
                    </div>
                    <label className="field">
                      <span>Section</span>
                      <select value={membershipSectionId} onChange={(event) => setMembershipSectionId(event.target.value)}>
                        <option value="">No section yet</option>
                        {activeSections.map((section) => (
                          <option key={section.sectionId} value={section.sectionId}>
                            {section.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="form-actions">
                      <button className="button button-primary" type="submit" disabled={formBusy}>
                        Save placement
                      </button>
                    </div>
                  </form>

                  <article className="panel">
                    <h3>Section roster</h3>
                    <p className="muted-copy">Choose a section to see the members placed there.</p>
                    <label className="field">
                      <span>Section</span>
                      <select
                        value={selectedDirectorSectionId}
                        onChange={(event) => setSelectedDirectorSectionId(event.target.value)}
                      >
                        <option value="">Choose section</option>
                        {activeSections.map((section) => (
                          <option key={section.sectionId} value={section.sectionId}>
                            {section.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="ensemble-list">
                      {selectedDirectorSection ? (
                        selectedDirectorSectionMemberships.length ? (
                          selectedDirectorSectionMemberships.map((membership) => (
                            <article className="ensemble-row panel" key={`${membership.userId}-${membership.ensembleId}`}>
                              <div>
                                <p className="ensemble-role">Member</p>
                                <h3>{membership.sectionName || selectedDirectorSection.name}</h3>
                                <p className="ensemble-status">{getMemberDisplayName(membership)} | Role: {membership.role}</p>
                              </div>
                              <button
                                className="button button-secondary"
                                type="button"
                                onClick={() => setSelectedDirectorMemberId(membership.userId)}
                              >
                                Open member
                              </button>
                            </article>
                          ))
                        ) : (
                          <article className="panel">
                            <h3>No members in this section yet</h3>
                            <p>Use the placement form to add an approved member to this section.</p>
                          </article>
                        )
                      ) : (
                        <article className="panel">
                          <h3>No section selected</h3>
                          <p>Choose a section to view its roster.</p>
                        </article>
                      )}
                    </div>
                  </article>
                </div>

                <div className="ensemble-list">
                  {activeMemberships.length ? (
                    activeMemberships.map((membership) => (
                      <article className="ensemble-row panel" key={`${membership.userId}-${membership.ensembleId}`}>
                        <div>
                          <p className="ensemble-role">Member</p>
                          <h3>{membership.sectionName || "Unassigned"}</h3>
                          <p className="ensemble-status">{getMemberDisplayName(membership)} | Role: {membership.role}</p>
                          <p className="ensemble-role">Status: {membership.status || "active"}</p>
                        </div>
                        <div className="form-actions">
                          <button
                            className="button button-primary"
                            type="button"
                            onClick={() => setSelectedDirectorMemberId(membership.userId)}
                          >
                            Open member
                          </button>
                          <button className="button button-secondary" type="button" onClick={() => handleRemoveMember(membership.userId, membership.ensembleId)}>
                            Remove
                          </button>
                          {membership.status !== "blocked" ? (
                            <button className="button button-secondary" type="button" onClick={() => handleBlockMember(membership.userId, membership.ensembleId)}>
                              Block
                            </button>
                          ) : null}
                        </div>
                      </article>
                    ))
                  ) : (
                    <article className="panel">
                      <h3>No members yet</h3>
                      <p>Approved members will appear here after they join with the ensemble code.</p>
                    </article>
                  )}
                </div>

                {selectedDirectorMember ? (
                  <article className="panel form-panel">
                    <div className="section-header">
                      <div>
                        <h3>Member details</h3>
                        <p className="muted-copy">{getMemberDisplayName(selectedDirectorMember)}</p>
                      </div>
                      <div className="form-actions">
                        <button
                          className="button button-secondary"
                          type="button"
                          onClick={() => handleRemoveMember(selectedDirectorMember.userId, selectedDirectorMember.ensembleId)}
                        >
                          Remove
                        </button>
                        {selectedDirectorMember.status !== "blocked" ? (
                          <button
                            className="button button-secondary"
                            type="button"
                            onClick={() => handleBlockMember(selectedDirectorMember.userId, selectedDirectorMember.ensembleId)}
                          >
                            Block
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="card-grid dashboard-grid">
                      <article className="panel">
                        <h3>Section</h3>
                        <p>{selectedDirectorMember.sectionName || "Unassigned"}</p>
                        <p className="ensemble-role">Role: {selectedDirectorMember.role}</p>
                      </article>
                      <article className="panel">
                        <h3>Missing assignments</h3>
                        <p>{selectedDirectorMemberMissingAssignments.length} open</p>
                      </article>
                      <article className="panel">
                        <h3>Submissions</h3>
                        <p>{selectedDirectorMemberSubmissions.length} submitted</p>
                      </article>
                    </div>

                    <div className="auth-grid">
                      <article className="panel">
                        <h3>Missing work</h3>
                        <div className="ensemble-list">
                          {selectedDirectorMemberMissingAssignments.length ? (
                            selectedDirectorMemberMissingAssignments.map((assignment) => (
                              <article className="ensemble-row panel" key={assignment.assignmentId}>
                                <div>
                                  <p className="ensemble-role">Due {assignment.dueDate || "unspecified"}</p>
                                  <h3>{assignment.title}</h3>
                                  <p className="ensemble-status">{assignment.description || "No description yet."}</p>
                                </div>
                              </article>
                            ))
                          ) : (
                            <article className="panel">
                              <h3>No missing assignments</h3>
                              <p>This member has no open assignments in their current section.</p>
                            </article>
                          )}
                        </div>
                      </article>

                      <article className="panel">
                        <h3>Submissions</h3>
                        <div className="ensemble-list">
                          {selectedDirectorMemberSubmissions.length ? (
                            selectedDirectorMemberSubmissions.map((submission) => (
                              <article className="ensemble-row panel" key={submission.submissionId}>
                                <div>
                                  <p className="ensemble-role">Assignment: {submission.assignmentId}</p>
                                  <h3>{submission.reviewStatus}</h3>
                                  <p className="ensemble-status">{submission.notes || "No notes yet."}</p>
                                </div>
                                <button
                                  className="button button-secondary"
                                  type="button"
                                  onClick={() => {
                                    setCommentSubmissionId(submission.submissionId);
                                    setReviewSubmissionId(submission.submissionId);
                                    setSelectedDirectorAssignmentId(submission.assignmentId);
                                    setDirectorView("assignment");
                                  }}
                                >
                                  Open
                                </button>
                              </article>
                            ))
                          ) : (
                            <article className="panel">
                              <h3>No submissions yet</h3>
                              <p>Submitted videos will appear here.</p>
                            </article>
                          )}
                        </div>
                      </article>
                    </div>

                    <form className="panel form-panel" onSubmit={handleDirectorMemberMessageSubmit}>
                      <h3>Send direct message</h3>
                      <p className="muted-copy">
                        Messages use the member's assigned section so visibility stays scoped correctly.
                      </p>
                      <label className="field">
                        <span>Message</span>
                        <textarea
                          value={directorMemberMessage}
                          onChange={(event) => setDirectorMemberMessage(event.target.value)}
                          placeholder="Write a message to this member"
                          rows={4}
                        />
                      </label>
                      <div className="form-actions">
                        <button
                          className="button button-primary"
                          type="submit"
                          disabled={formBusy || !selectedDirectorMember.sectionId}
                        >
                          Send message
                        </button>
                      </div>
                    </form>
                  </article>
                ) : null}

                <form className="panel form-panel" onSubmit={handleMessageSubmit}>
                  <div className="section-header">
                    <div>
                      <h3>Inbox</h3>
                      <p className="muted-copy">Direct and group conversations for this ensemble.</p>
                    </div>
                  </div>
                  <div className="ensemble-list">
                    {remoteConversations.length ? (
                      remoteConversations.map((conversation) => (
                        <article className="ensemble-row panel" key={conversation.conversationId}>
                          <div>
                            <p className="ensemble-role">
                              {conversation.sectionId
                                ? activeSections.find((section) => section.sectionId === conversation.sectionId)?.name ||
                                  conversation.sectionId
                                : "Ensemble"}
                            </p>
                            <h3>{conversation.title}</h3>
                            <p className="ensemble-status">{conversation.participantIds.length} participants</p>
                          </div>
                          <button
                            className="button button-secondary"
                            type="button"
                            onClick={() => setSectionMessageConversationId(conversation.conversationId)}
                          >
                            Open
                          </button>
                        </article>
                      ))
                    ) : (
                      <article className="panel">
                        <h3>No messages yet</h3>
                        <p>Direct messages and section conversations will appear here.</p>
                      </article>
                    )}
                  </div>

                  {sectionMessageConversationId ? (
                    <>
                      <div className="ensemble-list">
                        {remoteConversationMessages.length ? (
                          remoteConversationMessages.map((message) => (
                            <article className="ensemble-row panel" key={message.messageId}>
                              <div>
                                <p className="ensemble-role">From: {getMemberNameById(message.senderId)}</p>
                                <h3>{message.body}</h3>
                              </div>
                              <p className="ensemble-role">
                                {message.createdAt ? new Date(message.createdAt).toLocaleString() : "Unknown"}
                              </p>
                            </article>
                          ))
                        ) : (
                          <article className="panel">
                            <h3>No messages in this conversation</h3>
                            <p>Send the first message below.</p>
                          </article>
                        )}
                      </div>
                      <label className="field">
                        <span>Reply</span>
                        <textarea
                          value={sectionMessageBody}
                          onChange={(event) => setSectionMessageBody(event.target.value)}
                          placeholder="Write a reply"
                          rows={4}
                        />
                      </label>
                      <div className="form-actions">
                        <button className="button button-primary" type="submit" disabled={formBusy}>
                          Send reply
                        </button>
                      </div>
                    </>
                  ) : null}
                </form>

                <div className="section">
                  <div className="section-header">
                    <div>
                      <h3>Join requests</h3>
                      <p>Approve requests from members who entered the ensemble code.</p>
                    </div>
                  </div>
                  <div className="ensemble-list">
                    {remoteJoinRequests.length ? (
                      remoteJoinRequests.map((request) => (
                        <article className="ensemble-row panel" key={request.inviteCode}>
                          <div>
                            <p className="ensemble-role">{request.inviteeEmail || request.inviteeUserId}</p>
                            <h3>{request.role}</h3>
                            <p className="ensemble-status">{request.sectionName || "No section yet"} | {request.status}</p>
                          </div>
                          <button className="button button-primary" type="button" onClick={() => handleApproveRequest(request.inviteCode)}>
                            Approve
                          </button>
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
              </div>
            ) : null}

            {isDirectorMode && directorView !== "home" && selectedDirectorEnsemble && directorView === "sections" ? (
              <>
                <form className="panel form-panel" onSubmit={handleSectionSubmit}>
                  <div className="section-header">
                    <div>
                      <h3>Add section</h3>
                      <p>Create instrument groups inside the selected ensemble.</p>
                    </div>
                    <div className="form-actions">
                      <button className="button button-secondary" type="button" onClick={() => openDirectorEnsemble(selectedDirectorEnsemble.ensembleId)}>
                        Back to ensemble
                      </button>
                      <button className="button button-secondary" type="button" onClick={openDirectorHome}>
                        Home
                      </button>
                    </div>
                  </div>
                  <div className="form-grid">
                    <label className="field">
                      <span>Ensemble</span>
                      <select value={structureEnsembleId} onChange={(event) => setStructureEnsembleId(event.target.value)}>
                        <option value="">Choose ensemble</option>
                        {displayedEnsembles.map((ensemble) => (
                          <option key={ensemble.ensembleId} value={ensemble.ensembleId}>{ensemble.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Section name</span>
                      <input value={sectionName} onChange={(event) => setSectionName(event.target.value)} placeholder="Brass" />
                    </label>
                  </div>
                  <label className="field">
                    <span>Description</span>
                    <textarea value={sectionDescription} onChange={(event) => setSectionDescription(event.target.value)} rows={3} />
                  </label>
                  <div className="form-actions">
                    <button className="button button-primary" type="submit" disabled={formBusy}>Save section</button>
                  </div>
                </form>

                <div className="ensemble-list">
                  {selectedDirectorEnsemble
                    ? visibleSections
                        .filter((section) => section.ensembleId === selectedDirectorEnsemble.ensembleId)
                        .map((section) => (
                          <article className="ensemble-row panel" key={section.sectionId}>
                            <div>
                              <p className="ensemble-role">Section ID: {section.sectionId}</p>
                              <h3>{section.name}</h3>
                              <p className="ensemble-status">{section.description || "No description yet."}</p>
                            </div>
                            <div className="form-actions">
                              <button className="button button-primary" type="button" onClick={() => openDirectorSection(section.sectionId, section.ensembleId)}>
                                Open section
                              </button>
                            </div>
                          </article>
                        ))
                    : null}
                </div>
              </>
            ) : null}

            {isDirectorMode && directorView !== "home" && selectedDirectorEnsemble && directorView === "section" && selectedDirectorSection ? (
              <>
                <div className="section-header">
                  <div>
                    <h3>{selectedDirectorSection.name}</h3>
                    <p>{selectedDirectorSection.description || "No description yet."}</p>
                  </div>
                  <div className="form-actions">
                    <button className="button button-secondary" type="button" onClick={() => openDirectorEnsemble(selectedDirectorSection.ensembleId)}>Back to ensemble</button>
                    <button className="button button-secondary" type="button" onClick={openDirectorHome}>Home</button>
                  </div>
                </div>

                <div className="card-grid dashboard-grid">
                  <article className="panel">
                    <h3>Assignments in this section</h3>
                    <p>{selectedSectionAssignments.length} assignments</p>
                  </article>
                  <article className="panel">
                    <h3>Videos in this section</h3>
                    <p>{selectedSectionSubmissions.length} submissions</p>
                  </article>
                </div>

                <div className="ensemble-list">
                  {selectedSectionAssignments.length ? selectedSectionAssignments.map((assignment) => (
                    <article className="ensemble-row panel" key={assignment.assignmentId}>
                      <div>
                        <p className="ensemble-role">Assignment ID: {assignment.assignmentId}</p>
                        <h3>{assignment.title}</h3>
                        <p className="ensemble-status">{assignment.description || "No description yet."}</p>
                      </div>
                      <button className="button button-primary" type="button" onClick={() => openDirectorAssignment(assignment.assignmentId, assignment.ensembleId)}>
                        Open assignment
                      </button>
                    </article>
                  )) : (
                    <article className="panel"><h3>No section assignments yet</h3><p>Add a section-scoped assignment from the assignments page.</p></article>
                  )}
                </div>

                <div className="ensemble-list">
                  {selectedSectionSubmissions.length ? selectedSectionSubmissions.map((submission) => (
                    <article className="ensemble-row panel" key={submission.submissionId}>
                      <div>
                        <p className="ensemble-role">Submission: {submission.submissionId}</p>
                        <h3>{submission.reviewStatus}</h3>
                        <p className="ensemble-status">{submission.notes || "No notes yet."}</p>
                      </div>
                      <button className="button button-secondary" type="button" onClick={() => {
                        setCommentSubmissionId(submission.submissionId);
                        setReviewSubmissionId(submission.submissionId);
                        setDirectorView("assignment");
                      }}>
                        View comments
                      </button>
                    </article>
                  )) : (
                    <article className="panel"><h3>No submissions yet</h3><p>Section members will appear here after they submit videos.</p></article>
                  )}
                </div>
              </>
            ) : null}

            {isDirectorMode && directorView !== "home" && selectedDirectorEnsemble && directorView === "assignments" ? (
              <>
                <form className="panel form-panel" onSubmit={handleAssignmentSubmit}>
                  <div className="section-header">
                    <div>
                      <h3>Add assignment</h3>
                      <p>Create ensemble-wide or section-specific assignments.</p>
                    </div>
                    <div className="form-actions">
                      <button className="button button-secondary" type="button" onClick={() => openDirectorEnsemble(selectedDirectorEnsemble.ensembleId)}>Back to ensemble</button>
                      <button className="button button-secondary" type="button" onClick={openDirectorHome}>Home</button>
                    </div>
                  </div>
                  <div className="form-grid">
                    <label className="field">
                      <span>Ensemble</span>
                      <select value={assignmentEnsembleId} onChange={(event) => setAssignmentEnsembleId(event.target.value)}>
                        <option value="">Choose ensemble</option>
                        {displayedEnsembles.map((ensemble) => (
                          <option key={ensemble.ensembleId} value={ensemble.ensembleId}>{ensemble.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Target section</span>
                      <select value={assignmentSectionId} onChange={(event) => setAssignmentSectionId(event.target.value)}>
                        <option value="">Whole ensemble</option>
                        {visibleSections
                          .filter((section) => section.ensembleId === assignmentEnsembleId)
                          .map((section) => (
                            <option key={section.sectionId} value={section.sectionId}>{section.name}</option>
                          ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Due date</span>
                      <input type="date" value={assignmentDueDate} onChange={(event) => setAssignmentDueDate(event.target.value)} />
                    </label>
                  </div>
                  <label className="field">
                    <span>Title</span>
                    <input value={assignmentTitle} onChange={(event) => setAssignmentTitle(event.target.value)} placeholder="Rehearse measure 12-28" />
                  </label>
                  <label className="field">
                    <span>Description</span>
                    <textarea value={assignmentDescription} onChange={(event) => setAssignmentDescription(event.target.value)} rows={3} />
                  </label>
                  <div className="form-actions">
                    <button className="button button-primary" type="submit" disabled={formBusy}>Save assignment</button>
                  </div>
                </form>

                <div className="ensemble-list">
                  {visibleAssignments.filter((assignment) => assignment.ensembleId === assignmentEnsembleId).length
                    ? visibleAssignments
                        .filter((assignment) => assignment.ensembleId === assignmentEnsembleId)
                        .map((assignment) => (
                          <article className="ensemble-row panel" key={assignment.assignmentId}>
                            <div>
                              <p className="ensemble-role">{assignment.sectionId ? `Section: ${assignment.sectionId}` : "Whole ensemble"}</p>
                              <h3>{assignment.title}</h3>
                              <p className="ensemble-status">{assignment.description || "No description yet."}</p>
                            </div>
                            <button className="button button-primary" type="button" onClick={() => openDirectorAssignment(assignment.assignmentId, assignment.ensembleId)}>
                              Open assignment
                            </button>
                          </article>
                        ))
                    : (
                      <article className="panel"><h3>No assignments yet</h3><p>Create the first assignment for this ensemble.</p></article>
                    )}
                </div>
              </>
            ) : null}

            {isDirectorMode && directorView !== "home" && selectedDirectorEnsemble && directorView === "assignment" && selectedDirectorAssignment ? (
              <>
                <div className="section-header">
                  <div>
                    <h3>{selectedDirectorAssignment.title}</h3>
                    <p>{selectedDirectorAssignment.description || "No description yet."}</p>
                    <p className="muted-copy">Due {selectedDirectorAssignment.dueDate || "unspecified"}</p>
                  </div>
                  <div className="form-actions">
                    <button className="button button-secondary" type="button" onClick={() => openDirectorAssignments(selectedDirectorAssignment.ensembleId)}>Back to assignments</button>
                    <button className="button button-secondary" type="button" onClick={openDirectorHome}>Home</button>
                  </div>
                </div>

                <div className="ensemble-list">
                  {selectedAssignmentSubmissions.length ? selectedAssignmentSubmissions.map((submission) => (
                    <article className="ensemble-row panel" key={submission.submissionId}>
                      <div>
                        <p className="ensemble-role">Submission: {submission.submissionId}</p>
                        <h3>{submission.reviewStatus}</h3>
                        <p className="ensemble-status">{submission.notes || "No notes yet."}</p>
                        <p className="ensemble-role">Section: {submission.sectionId || "unassigned"}</p>
                      </div>
                      <div className="form-actions">
                        <button className="button button-secondary" type="button" onClick={() => {
                          setCommentSubmissionId(submission.submissionId);
                          setReviewSubmissionId(submission.submissionId);
                        }}>
                          Comments
                        </button>
                      </div>
                    </article>
                  )) : (
                    <article className="panel"><h3>No submissions yet</h3><p>Member videos for this assignment will appear here.</p></article>
                  )}
                </div>

                <div className="auth-grid">
                  <form className="panel form-panel" onSubmit={handleCommentSubmit}>
                    <h3>Add comment</h3>
                    <label className="field">
                      <span>Submission</span>
                      <select value={commentSubmissionId} onChange={(event) => setCommentSubmissionId(event.target.value)}>
                        <option value="">Choose submission</option>
                        {selectedAssignmentSubmissions.map((submission) => (
                          <option key={submission.submissionId} value={submission.submissionId}>{submission.submissionId}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Comment</span>
                      <textarea value={commentBody} onChange={(event) => setCommentBody(event.target.value)} placeholder="Leave a note with text or emojis" rows={4} />
                    </label>
                    <div className="form-actions">
                      <button className="button button-primary" type="submit" disabled={formBusy}>Save comment</button>
                    </div>
                  </form>

                  <form className="panel form-panel" onSubmit={handleReviewSubmit}>
                    <h3>Review</h3>
                    <label className="field">
                      <span>Submission</span>
                      <select value={reviewSubmissionId} onChange={(event) => setReviewSubmissionId(event.target.value)}>
                        <option value="">Choose submission</option>
                        {selectedAssignmentSubmissions.map((submission) => (
                          <option key={submission.submissionId} value={submission.submissionId}>{submission.submissionId}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Status</span>
                      <select value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value)}>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="needs_work">Needs work</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>Feedback</span>
                      <textarea value={reviewFeedback} onChange={(event) => setReviewFeedback(event.target.value)} rows={4} />
                    </label>
                    <div className="form-actions">
                      <button className="button button-primary" type="submit" disabled={formBusy}>Save review</button>
                    </div>
                  </form>
                </div>

                <div className="ensemble-list">
                  {visibleComments.filter((comment) => commentSubmissionId && comment.submissionId === commentSubmissionId).length ? (
                    visibleComments
                      .filter((comment) => commentSubmissionId && comment.submissionId === commentSubmissionId)
                      .map((comment) => (
                        <article className="ensemble-row panel" key={comment.commentId}>
                          <div>
                            <p className="ensemble-role">Author: {comment.authorId}</p>
                            <h3>{comment.body}</h3>
                          </div>
                          <p className="ensemble-role">{comment.createdAt ? new Date(comment.createdAt).toLocaleString() : "Unknown"}</p>
                        </article>
                      ))
                  ) : (
                    <article className="panel">
                      <h3>No comments yet</h3>
                      <p>Select a submission to see the thread.</p>
                    </article>
                  )}
                </div>
              </>
            ) : null}

            {isDirectorMode && directorView !== "home" && selectedDirectorEnsemble && directorView === "announcements" ? (
              <>
                <form className="panel form-panel" onSubmit={handleAnnouncementSubmit}>
                  <div className="section-header">
                    <div>
                      <h3>Post announcement</h3>
                      <p>Send a message to everyone in the ensemble inbox.</p>
                    </div>
                    <div className="form-actions">
                      <button className="button button-secondary" type="button" onClick={() => openDirectorEnsemble(selectedDirectorEnsemble.ensembleId)}>Back to ensemble</button>
                      <button className="button button-secondary" type="button" onClick={openDirectorHome}>Home</button>
                    </div>
                  </div>
                  <label className="field">
                    <span>Announcement</span>
                    <textarea value={announcementBody} onChange={(event) => setAnnouncementBody(event.target.value)} placeholder="Concert reminder, rehearsal change, or section note" rows={4} />
                  </label>
                  <div className="form-actions">
                    <button className="button button-primary" type="submit" disabled={formBusy}>Post announcement</button>
                  </div>
                </form>

                <div className="ensemble-list">
                  {directorAnnouncements.length ? (
                    directorAnnouncements.map((notification) => (
                      <article className="ensemble-row panel" key={notification.notificationId}>
                        <div>
                          <p className="ensemble-role">{notification.entityType}</p>
                          <h3>{notification.message}</h3>
                          <p className="ensemble-status">{notification.isRead ? "Read" : "Unread"}</p>
                        </div>
                      </article>
                    ))
                  ) : (
                    <article className="panel">
                      <h3>No announcements yet</h3>
                      <p>Post the first update to notify the ensemble.</p>
                    </article>
                  )}
                </div>
              </>
            ) : null}
          </section>

          {toastMessage ? (
            <div className={`toast toast-${toastKind}`} role="status" aria-live="polite">
              {toastMessage}
            </div>
          ) : null}
        </div>

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
                  <h2>Edit profile</h2>
                  <p>Update your username, name, and profile photo.</p>
                </div>
                <button className="button button-secondary" type="button" onClick={() => setProfileModalOpen(false)}>
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
                <span>Username</span>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="unique-handle"
                />
              </label>

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
      </main>
    );
  }

  if (!showWorkspace) {
    return (
      <main className="auth-shell">
        <section className="auth-hero panel panel-accent">
          <BrandLogo />
          <h1>Choose how you want to sign in.</h1>
          <p className="lede">
            Directors and members use the same secure Cognito login, but they land on different dashboards.
          </p>
          <p className="muted-copy">
            Sign in with email and password. Use the forgot-password link if you need a reset.
          </p>
        </section>

        <section className="auth-grid">
          <div className="panel form-panel">
            <h3>Director access</h3>
            <p className="muted-copy">
              {cognitoDomain && cognitoClientId && cognitoRedirectUri
                ? "Use this if your email is approved for the director dashboard."
                : "Set the sign-in environment variables to enable hosted login."}
            </p>
            <div className="form-actions">
              <button
                className="button button-primary"
                type="button"
                onClick={() => handlePortalSignIn("director")}
                disabled={!cognitoDomain || !cognitoClientId || !cognitoRedirectUri}
              >
                Sign in as director
              </button>
            </div>
            <p className="muted-copy">Only approved email addresses can use the director dashboard.</p>
            <p className="muted-copy">Profile edits, ensembles, and assignments live in the director view.</p>
          </div>

          <div className="panel form-panel">
            <h3>Member access</h3>
            <p className="muted-copy">
              Use this if you are joining an ensemble as a member.
            </p>
            <div className="form-actions">
              <button
                className="button button-primary"
                type="button"
                onClick={() => handlePortalSignIn("member")}
                disabled={!cognitoDomain || !cognitoClientId || !cognitoRedirectUri}
              >
                Sign in as member
              </button>
            </div>
            <p className="muted-copy">Members see their ensembles, assignments, submissions, and section feed.</p>
            <p className="muted-copy">Password resets go through Cognito email recovery.</p>
          </div>

        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar panel">
        <div>
          <BrandLogo compact />
          <h2>{isDirectorMode ? "Director dashboard" : "Member dashboard"}</h2>
          <p className="muted-copy">
            {isDirectorMode
              ? "Manage ensembles and assignments from a focused director view."
              : "Track your ensembles, assignments, submissions, and section updates."}
          </p>
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
          {navigationItems.map((item) => (
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

      </aside>

      <div className="workspace">
        <section className="hero" id="overview">
          <div className="hero-topline">
            <BrandLogo compact />
          </div>
          <div className="hero-grid hero-grid-main">
            <div>
              <h1>Keep ensembles organized and accountable.</h1>
              <p className="lede">
                {isDirectorMode
                  ? "Use the director portal to manage ensembles, members, and assignments."
                  : "Use the member portal to see your ensembles, assignments, and practice submissions."}
              </p>
            </div>

            <article className="panel panel-accent">
              <h2>Current focus</h2>
              <p>
                {isDirectorMode
                  ? "Director access is reserved for approved email addresses."
                  : "Members only see the ensembles and sections they belong to."}
              </p>
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
                {signedInUsername ? <p className="muted-copy">@{signedInUsername}</p> : null}
              </div>
              <div className="account-actions">
                <button className="button button-primary" type="button" onClick={openProfileEditor}>
                  Edit profile photo
                </button>
                <button className="button button-secondary" type="button" onClick={handleSignOut}>
                  Sign out
                </button>
              </div>
            </article>

            {!isDirectorMode ? (
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
            ) : null}
          </div>
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

        {isDirectorMode ? (
          <>
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
          </>
        ) : (
          <article className="panel">
            <h3>Join with a code</h3>
            <p className="muted-copy">Ask your director for the ensemble code if you are not already in the group.</p>
          </article>
        )}

        <div className="ensemble-list">
          {displayedEnsembles.map((ensemble) => (
            <article className="ensemble-row panel" key={ensemble.ensembleId}>
              <div>
                <p className="ensemble-role">Owner: {ensemble.ownerId}</p>
                <h3>{ensemble.name}</h3>
                {ensembleLogoUrls[ensemble.ensembleId] ? (
                  <img
                    className="ensemble-logo-preview"
                    src={ensembleLogoUrls[ensemble.ensembleId]}
                    alt={`${ensemble.name} logo`}
                  />
                ) : null}
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
              <div className="form-actions">
                <button
                  className="button button-primary"
                  type="button"
                  onClick={() =>
                    isDirectorMode
                      ? openDirectorEnsemble(ensemble.ensembleId)
                      : openMemberEnsemble(ensemble.ensembleId)
                  }
                >
                  Open ensemble
                </button>
              </div>
            </article>
          ))}
        </div>

        {!isDirectorMode && selectedDirectorEnsemble ? (
          <article className="panel panel-accent">
            <div className="section-header">
              <div>
                <h3>{selectedDirectorEnsemble.name}</h3>
                <p className="muted-copy">Open one part of this ensemble at a time.</p>
              </div>
              <button className="button button-secondary" type="button" onClick={openMemberHome}>
                Back to ensembles
              </button>
            </div>

            {memberView === "ensemble" ? (
              <div className="card-grid dashboard-grid">
                <article className="panel">
                  <h3>Announcements</h3>
                  <p className="muted-copy">
                    {latestMemberAnnouncement ? latestMemberAnnouncement.message : "No announcements yet."}
                  </p>
                  <button className="button button-secondary" type="button" onClick={openMemberAnnouncements}>
                    Open announcements
                  </button>
                </article>

                <article className="panel">
                  <h3>Your section</h3>
                  <p className="muted-copy">
                    {selectedMemberSection
                      ? selectedMemberSection.sectionName ||
                        visibleSections.find((section) => section.sectionId === selectedMemberSection.sectionId)?.name ||
                        "Unassigned"
                      : "Your director will place you in a section after approval."}
                  </p>
                  <button className="button button-secondary" type="button" onClick={openMemberSection}>
                    Open section
                  </button>
                </article>

                <article className="panel">
                  <h3>Messages</h3>
                  <p className="muted-copy">Message people in your section or start a group chat.</p>
                  <button className="button button-secondary" type="button" onClick={openMemberMessages}>
                    Open messages
                  </button>
                </article>

                <article className="panel">
                  <h3>Assignments</h3>
                  <p className="muted-copy">See what is due and upload your practice video.</p>
                  <button className="button button-secondary" type="button" onClick={openMemberAssignments}>
                    Open assignments
                  </button>
                </article>
              </div>
            ) : null}

            {memberView === "announcements" ? (
              <div className="ensemble-list">
                {directorAnnouncements.length ? (
                  directorAnnouncements.map((notification) => (
                    <article className="ensemble-row panel" key={notification.notificationId}>
                      <div>
                        <p className="ensemble-role">{notification.entityType}</p>
                        <h3>{notification.message}</h3>
                      </div>
                      <p className="ensemble-role">{notification.isRead ? "Read" : "Unread"}</p>
                    </article>
                  ))
                ) : (
                  <article className="panel">
                    <h3>No announcements yet</h3>
                    <p>Open the ensemble to see updates from the director.</p>
                  </article>
                )}
              </div>
            ) : null}

            {memberView === "section" ? (
              <div className="card-grid dashboard-grid">
                <article className="panel">
                  <div className="section-header">
                    <div>
                      <h3>Your section</h3>
                      <p className="muted-copy">See who is in your section and who you can message.</p>
                    </div>
                    <button className="button button-secondary" type="button" onClick={() => setMemberView("ensemble")}>
                      Back
                    </button>
                  </div>
                  {currentMemberSectionIds.length > 1 ? (
                    <label className="field">
                      <span>Choose section</span>
                      <select
                        value={selectedMemberSectionId}
                        onChange={(event) => setSelectedMemberSectionId(event.target.value)}
                      >
                        {currentMemberSectionIds.map((sectionId) => {
                          const section = visibleSections.find((item) => item.sectionId === sectionId);
                          return (
                            <option key={sectionId} value={sectionId}>
                              {section?.name || sectionId}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                  ) : null}
                  <p className="muted-copy">
                    {selectedMemberSection
                      ? selectedMemberSection.sectionName ||
                        visibleSections.find((section) => section.sectionId === selectedMemberSection.sectionId)?.name ||
                        "Unassigned"
                      : "Your director will place you in a section after approval."}
                  </p>
                  <div className="ensemble-list">
                    {currentSectionRoster.length ? (
                      currentSectionRoster.map((membership) => (
                        <article className="ensemble-row panel" key={`${membership.userId}-${membership.ensembleId}`}>
                          <div>
                            <p className="ensemble-role">Member</p>
                            <h3>{membership.sectionName || "Section member"}</h3>
                            <p className="ensemble-status">{getMemberDisplayName(membership)} | Role: {membership.role}</p>
                          </div>
                        </article>
                      ))
                    ) : (
                      <article className="panel">
                        <h3>No section members yet</h3>
                        <p>Other musicians in your section will appear here.</p>
                      </article>
                    )}
                  </div>
                </article>
              </div>
            ) : null}

            {memberView === "messages" ? (
              <div className="card-grid dashboard-grid">
                <form className="panel form-panel" onSubmit={handleConversationSubmit}>
                  <div className="section-header">
                    <div>
                      <h3>Messages</h3>
                      <p className="muted-copy">Start a conversation with one person or a group in your section.</p>
                    </div>
                    <button className="button button-secondary" type="button" onClick={() => setMemberView("ensemble")}>
                      Back
                    </button>
                  </div>
                  <label className="field">
                    <span>Conversation title</span>
                    <input
                      value={sectionMessageTitle}
                      onChange={(event) => setSectionMessageTitle(event.target.value)}
                      placeholder="Brass check-in"
                    />
                  </label>
                  <div className="field">
                    <span>Select members</span>
                    <div className="checkbox-list">
                      {currentSectionRoster.length ? (
                        currentSectionRoster.map((membership) => (
                          <label className="checkbox-row" key={`${membership.userId}-${membership.ensembleId}`}>
                            <input
                              type="checkbox"
                              checked={conversationParticipantIds.includes(membership.userId)}
                              onChange={(event) => {
                                setConversationParticipantIds((current) =>
                                  event.target.checked
                                    ? [...current, membership.userId]
                                    : current.filter((item) => item !== membership.userId),
                                );
                              }}
                            />
                            <span>{getMemberDisplayName(membership)}</span>
                          </label>
                        ))
                      ) : (
                        <p className="muted-copy">No additional section members yet.</p>
                      )}
                    </div>
                  </div>
                  <div className="form-actions">
                    <button className="button button-primary" type="submit" disabled={formBusy}>
                      Start group
                    </button>
                  </div>
                  <div className="ensemble-list">
                    {remoteConversations.length ? (
                      remoteConversations.map((conversation) => (
                        <article className="ensemble-row panel" key={conversation.conversationId}>
                          <div>
                            <p className="ensemble-role">{conversation.sectionId}</p>
                            <h3>{conversation.title}</h3>
                            <p className="ensemble-status">
                              {conversation.participantIds.length} people in thread
                            </p>
                          </div>
                          <button
                            className="button button-secondary"
                            type="button"
                            onClick={() => setSectionMessageConversationId(conversation.conversationId)}
                          >
                            Open
                          </button>
                        </article>
                      ))
                    ) : (
                      <article className="panel">
                        <h3>No conversations yet</h3>
                        <p>Start one for a subgroup or the full section.</p>
                      </article>
                    )}
                  </div>
                  <label className="field">
                    <span>Message</span>
                    <textarea
                      value={sectionMessageBody}
                      onChange={(event) => setSectionMessageBody(event.target.value)}
                      placeholder="Say something to the group"
                      rows={4}
                    />
                  </label>
                  <div className="form-actions">
                    <button className="button button-primary" type="submit" disabled={formBusy || !sectionMessageConversationId}>
                      Send message
                    </button>
                  </div>
                  <div className="ensemble-list">
                    {remoteConversationMessages.length ? (
                      remoteConversationMessages.map((message) => (
                        <article className="ensemble-row panel" key={message.messageId}>
                          <div>
                            <p className="ensemble-role">From: {getMemberNameById(message.senderId)}</p>
                            <h3>{message.body}</h3>
                          </div>
                          <p className="ensemble-role">
                            {message.createdAt ? new Date(message.createdAt).toLocaleString() : "Unknown"}
                          </p>
                        </article>
                      ))
                    ) : (
                      <article className="panel">
                        <h3>No messages yet</h3>
                        <p>Open or start a group to see the chat.</p>
                      </article>
                    )}
                  </div>
                </form>
              </div>
            ) : null}

            {memberView === "assignments" ? (
              <div className="card-grid dashboard-grid">
                <article className="panel form-panel">
                  <div className="section-header">
                    <div>
                      <h3>Assignments</h3>
                      <p className="muted-copy">See what is due and upload your practice video.</p>
                    </div>
                    <button className="button button-secondary" type="button" onClick={() => setMemberView("ensemble")}>
                      Back
                    </button>
                  </div>
                  <div className="ensemble-list">
                    {memberOutstandingAssignments.length ? (
                      memberOutstandingAssignments.map((assignment) => (
                        <article className="ensemble-row panel" key={assignment.assignmentId}>
                          <div>
                            <p className="ensemble-role">Due {assignment.dueDate || "unspecified"}</p>
                            <h3>{assignment.title}</h3>
                            <p className="ensemble-status">{assignment.description || "No description yet."}</p>
                          </div>
                        </article>
                      ))
                    ) : (
                      <article className="panel">
                        <h3>Nothing due right now</h3>
                        <p>Turn in any remaining tasks or wait for your director to post new ones.</p>
                      </article>
                    )}
                  </div>

                  <form className="panel form-panel" onSubmit={handleSubmissionSubmit}>
                    <h3>Upload a practice video</h3>
                    <label className="field">
                      <span>Assignment</span>
                      <select
                        value={submissionAssignmentId}
                        onChange={(event) => setSubmissionAssignmentId(event.target.value)}
                      >
                        <option value="">Choose assignment</option>
                        {currentMemberAssignments.map((assignment) => (
                          <option key={assignment.assignmentId} value={assignment.assignmentId}>
                            {assignment.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Video</span>
                      <input
                        type="file"
                        accept="video/*"
                        onChange={(event) => setSubmissionFile(event.target.files?.[0] ?? null)}
                      />
                    </label>
                    <label className="field">
                      <span>Notes</span>
                      <textarea
                        value={submissionNotes}
                        onChange={(event) => setSubmissionNotes(event.target.value)}
                        placeholder="Anything your director should know?"
                        rows={3}
                      />
                    </label>
                    <div className="form-actions">
                      <button className="button button-primary" type="submit" disabled={formBusy}>
                        Save video
                      </button>
                    </div>
                  </form>
                </article>
              </div>
            ) : null}
          </article>
        ) : null}
      </section>

      {isDirectorMode ? (
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
              <h3>Place approved member in section</h3>
              <div className="form-grid">
                <label className="field">
                  <span>Approved member</span>
                  <select
                    value={membershipUserId}
                    onChange={(event) => setMembershipUserId(event.target.value)}
                  >
                    <option value="">Choose member</option>
                    {approvedMemberships.map((membership) => (
                      <option key={`${membership.userId}-${membership.ensembleId}`} value={membership.userId}>
                        {getMemberDisplayName(membership)} {membership.sectionName ? `(${membership.sectionName})` : ""}
                      </option>
                    ))}
                  </select>
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
                  Place member
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

        <div className="card-grid dashboard-grid">
          <article className="panel">
            <h3>Ensemble members</h3>
            <p className="muted-copy">Everyone approved for this ensemble.</p>
            <div className="ensemble-list">
              {activeMemberships.length ? (
                activeMemberships.map((membership) => (
                  <article className="ensemble-row panel" key={`${membership.userId}-${membership.ensembleId}`}>
                    <div>
                      <p className="ensemble-role">Member</p>
                      <h3>{membership.sectionName || "Unassigned"}</h3>
                      <p className="ensemble-status">{getMemberDisplayName(membership)} | Role: {membership.role}</p>
                    </div>
                  </article>
                ))
              ) : (
                <article className="panel">
                  <h3>No members yet</h3>
                  <p>Approved members will appear here.</p>
                </article>
              )}
            </div>
          </article>

          <article className="panel">
            <h3>Section roster</h3>
            <p className="muted-copy">Pick a section to see who is in it.</p>
            <label className="field">
              <span>Section</span>
              <select
                value={selectedDirectorSectionId}
                onChange={(event) => setSelectedDirectorSectionId(event.target.value)}
              >
                <option value="">Choose section</option>
                {activeSections.map((section) => (
                  <option key={section.sectionId} value={section.sectionId}>
                    {section.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="ensemble-list">
              {selectedDirectorSection ? (
                selectedDirectorSectionMemberships.length ? (
                  selectedDirectorSectionMemberships.map((membership) => (
                    <article className="ensemble-row panel" key={`${membership.userId}-${membership.ensembleId}`}>
                      <div>
                        <p className="ensemble-role">Member</p>
                        <h3>{membership.sectionName || "Section member"}</h3>
                        <p className="ensemble-status">{getMemberDisplayName(membership)} | Role: {membership.role}</p>
                      </div>
                    </article>
                  ))
                ) : (
                  <article className="panel">
                    <h3>No members in this section yet</h3>
                    <p>Place an approved member into the section from the placement form above.</p>
                  </article>
                )
              ) : (
                <article className="panel">
                  <h3>No section selected</h3>
                  <p>Choose a section to see its roster.</p>
                </article>
              )}
            </div>
          </article>
        </div>

        <div className="ensemble-list">
          {activeMemberships.length ? (
            activeMemberships.map((membership) => (
              <article className="ensemble-row panel" key={`${membership.userId}-${membership.ensembleId}`}>
                <div>
                  <p className="ensemble-role">Member</p>
                  <h3>{membership.sectionName || "Unassigned"}</h3>
                  <p className="ensemble-status">{getMemberDisplayName(membership)} | Role: {membership.role}</p>
                </div>
                <div>
                  <p className="ensemble-role">
                    Joined {membership.joinedAt ? new Date(membership.joinedAt).toLocaleDateString() : "unknown"}
                  </p>
                  <p className="ensemble-role">Status: {membership.status || "active"}</p>
                  {isDirectorMode ? (
                    <div className="form-actions">
                      <button
                        className="button button-secondary"
                        type="button"
                        onClick={() => handleRemoveMember(membership.userId, membership.ensembleId)}
                      >
                        Remove from ensemble
                      </button>
                      {membership.status !== "blocked" ? (
                        <button
                          className="button button-secondary"
                          type="button"
                          onClick={() => handleBlockMember(membership.userId, membership.ensembleId)}
                        >
                          Block member
                        </button>
                      ) : null}
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
      ) : null}

      {isDirectorMode ? (
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
        ) : selectedDirectorEnsemble ? (
          <form className="panel form-panel" onSubmit={handleSubmissionSubmit}>
            <div className="section-header">
              <div>
                <h3>Upload a practice video</h3>
                <p>Pick an assignment for the selected ensemble, then upload your video.</p>
              </div>
            </div>
            <label className="field">
              <span>Assignment</span>
              <select
                value={submissionAssignmentId}
                onChange={(event) => setSubmissionAssignmentId(event.target.value)}
              >
                <option value="">Choose assignment</option>
                {currentAssignments.map((assignment) => (
                  <option key={assignment.assignmentId} value={assignment.assignmentId}>
                    {assignment.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Video</span>
              <input
                type="file"
                accept="video/*"
                onChange={(event) => setSubmissionFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <label className="field">
              <span>Notes</span>
              <textarea
                value={submissionNotes}
                onChange={(event) => setSubmissionNotes(event.target.value)}
                placeholder="Anything your director should know?"
                rows={3}
              />
            </label>
            <div className="form-actions">
              <button className="button button-primary" type="submit" disabled={formBusy}>
                Save video
              </button>
            </div>
          </form>
        ) : (
          <article className="panel">
            <h3>Assigned to you</h3>
            <p className="muted-copy">Open an ensemble to see the assignments and upload area.</p>
          </article>
        )}

        <div className="ensemble-list">
          {currentAssignments.map((assignment) => (
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
      ) : null}

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
                <h2>Edit profile</h2>
                <p>Update your username, name, and profile photo.</p>
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
              <span>Username</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="unique-handle"
              />
            </label>

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

            {formMessage ? <p className="muted-copy">{formMessage}</p> : null}

            <div className="form-actions">
              <button className="button button-primary" type="submit" disabled={formBusy}>
                {formBusy ? "Saving..." : "Save profile"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

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
