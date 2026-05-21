import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  apiUrl,
  createAssignment,
  createEnsemble,
  createSubmission,
  createUploadPresign,
  fetchHealthSignal,
  getCurrentProfile,
  listAssignments,
  listEnsembles,
  listSubmissions,
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

const dashboardCards = [
  {
    title: "Profile",
    body: "Store display name, photo, and role information for each account.",
  },
  {
    title: "Ensembles",
    body: "Manage one or more groups, each with its own sections and members.",
  },
  {
    title: "Uploads",
    body: "Send profile photos, ensemble logos, and practice videos to S3.",
  },
  {
    title: "Assignments",
    body: "Track due dates, completion, and feedback for practice work.",
  },
];

const rolloutSteps = [
  "Log in with Cognito",
  "Create or edit a profile",
  "Add an ensemble",
  "Upload photos and logos",
  "Track assignments and submissions",
];

const placeholderProfile = {
  userId: "demo-user",
  email: "demo@example.com",
  displayName: "Demo musician",
  photoKey: "",
};

function App() {
  const [apiState, setApiState] = useState("Checking backend connection...");
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [tokenDraft, setTokenDraft] = useState("");
  const [profile, setProfile] = useState(placeholderProfile);
  const [remoteEnsembles, setRemoteEnsembles] = useState<Array<{
    ensembleId: string;
    ownerId: string;
    name: string;
    description: string;
    logoKey: string;
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
  const [remoteSubmissions, setRemoteSubmissions] = useState<Array<{
    submissionId: string;
    assignmentId: string;
    ownerId: string;
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
  const [ensembleName, setEnsembleName] = useState("New ensemble");
  const [ensembleDescription, setEnsembleDescription] = useState("");
  const [ensembleLogoFile, setEnsembleLogoFile] = useState<File | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadEnsembleId, setUploadEnsembleId] = useState("");
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
  const [formMessage, setFormMessage] = useState("Use Cognito sign-in or paste a token to try the API forms.");
  const [authMessage, setAuthMessage] = useState("Not signed in.");
  const [formBusy, setFormBusy] = useState(false);

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
          setFormMessage("Signed in with Cognito.");
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
        setRemoteAssignments([]);
        setRemoteSubmissions([]);
        return;
      }

      try {
        const [profileResponse, ensemblesResponse, assignmentsResponse, submissionsResponse] =
          await Promise.all([
          getCurrentProfile(accessToken),
          listEnsembles(accessToken),
          listAssignments(accessToken),
          listSubmissions(accessToken),
        ]);

        if (cancelled) return;

        if (profileResponse.profile) {
          setProfile(profileResponse.profile);
          setDisplayName(profileResponse.profile.displayName || "");
          setEmail(profileResponse.profile.email || "");
        }

        setRemoteEnsembles(ensemblesResponse.ensembles);
        setRemoteAssignments(assignmentsResponse.assignments);
        setRemoteSubmissions(submissionsResponse.submissions);
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

  const connectionLabel = useMemo(() => {
    if (!apiUrl) {
      return "API URL not configured";
    }

    return apiUrl;
  }, []);

  const displayedEnsembles = remoteEnsembles.length
    ? remoteEnsembles
    : [
        {
          ensembleId: "ensemble-1",
          ownerId: profile.userId,
          name: "Mariachi Los Soles",
          description: "Director-managed ensemble.",
          logoKey: "",
        },
        {
          ensembleId: "ensemble-2",
          ownerId: profile.userId,
          name: "West Campus Wind Ensemble",
          description: "Student ensemble with sectional leads.",
          logoKey: "",
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
    setProfile(placeholderProfile);
    setDisplayName(placeholderProfile.displayName);
    setEmail(placeholderProfile.email);
    setAuthMessage("Signed out.");

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
      throw new Error("Sign in with Cognito or paste an access token first.");
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
      throw new Error("Upload to S3 failed.");
    }

    return presign.fileKey;
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
      setFormMessage("Submission saved.");
      setSubmissionFile(null);
      setSubmissionNotes("");
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
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Review save failed.");
    } finally {
      setFormBusy(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero-topline">
          <p className="eyebrow">EnsembleFlow</p>
          <div className="topline-statuses">
            <span className="status-chip">{apiState}</span>
            <span className="status-chip status-chip-muted">{authMessage}</span>
          </div>
        </div>
        <div className="hero-grid hero-grid-main">
          <div>
            <h1>Keep ensembles organized and accountable.</h1>
            <p className="lede">
              EnsembleFlow brings profiles, groups, sections, uploads, and
              practice tracking into one workspace for music teams.
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
      </section>

      <section className="section">
        <div className="section-header">
          <div>
            <h2>Workspace overview</h2>
            <p>Simple dashboard areas for the first version of the app.</p>
          </div>
          <p className="section-meta">Connected endpoint: {connectionLabel}</p>
        </div>

        <div className="card-grid dashboard-grid">
          {dashboardCards.map((item) => (
            <article className="panel" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <div>
            <h2>Authentication</h2>
            <p>
              Use Cognito sign-in for the normal path. The access token input
              stays available as a fallback for local testing.
            </p>
          </div>
        </div>

        <div className="auth-grid">
          <div className="panel form-panel">
            <h3>Cognito sign-in</h3>
            <p className="muted-copy">
              {cognitoDomain && cognitoClientId && cognitoRedirectUri
                ? "The hosted UI is configured for this environment."
                : "Set the Cognito environment variables to enable hosted login."}
            </p>
            <div className="form-actions">
              <button
                className="button button-primary"
                type="button"
                onClick={handleSignIn}
                disabled={!cognitoDomain || !cognitoClientId || !cognitoRedirectUri}
              >
                Sign in with Cognito
              </button>
              <button
                className="button button-secondary"
                type="button"
                onClick={handleSignOut}
                disabled={!authSession && !accessToken}
              >
                Sign out
              </button>
            </div>
            <p className="muted-copy">
              Logout URL configured: {cognitoLogoutUri ? "yes" : "no"}
            </p>
          </div>

          <form className="panel form-panel" onSubmit={handleApplyToken}>
            <label className="field">
              <span>Manual access token</span>
              <textarea
                value={tokenDraft}
                onChange={(event) => setTokenDraft(event.target.value)}
                placeholder="Paste Cognito access token here"
                rows={4}
              />
            </label>
            <div className="form-actions">
              <button className="button button-primary" type="submit">
                Use token
              </button>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => {
                  setTokenDraft("");
                  setAccessToken("");
                  setAuthSession(null);
                  setAuthMessage("Manual token cleared.");
                  setFormMessage("Token cleared. Preview mode restored.");
                }}
              >
                Clear
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <div>
            <h2>Profile</h2>
            <p>Create or update the signed-in user profile.</p>
          </div>
          <p className="section-meta">
            Current profile: {profile.displayName || "Not loaded yet"}
          </p>
        </div>

        <form className="panel form-panel" onSubmit={handleProfileSubmit}>
          <div className="form-grid">
            <label className="field">
              <span>Display name</span>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Musician name"
              />
            </label>
            <label className="field">
              <span>Email</span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                type="email"
              />
            </label>
          </div>
          <label className="field">
            <span>Profile photo</span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setProfilePhotoFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <div className="form-actions">
            <button className="button button-primary" type="submit" disabled={formBusy}>
              Save profile
            </button>
          </div>
        </form>
      </section>

      <section className="section">
        <div className="section-header">
          <div>
            <h2>Ensembles</h2>
            <p>Add new groups and keep their logos and descriptions organized.</p>
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

        <div className="ensemble-list">
          {displayedEnsembles.map((ensemble) => (
            <article className="ensemble-row panel" key={ensemble.ensembleId}>
              <div>
                <p className="ensemble-role">Owner: {ensemble.ownerId}</p>
                <h3>{ensemble.name}</h3>
                <p className="ensemble-status">{ensemble.description || "No description yet."}</p>
              </div>
              <p className="ensemble-role">{ensemble.logoKey ? "Logo uploaded" : "No logo yet"}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <div>
            <h2>Assignments</h2>
            <p>Create practice tasks for a specific ensemble and due date.</p>
          </div>
        </div>

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

        <div className="ensemble-list">
          {remoteAssignments.map((assignment) => (
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

      <section className="section">
        <div className="section-header">
          <div>
            <h2>Submissions</h2>
            <p>Upload a practice video and attach notes for a specific assignment.</p>
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
                {remoteAssignments.map((assignment) => (
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
          {remoteSubmissions.map((submission) => (
            <article className="ensemble-row panel" key={submission.submissionId}>
              <div>
                <p className="ensemble-role">Assignment: {submission.assignmentId}</p>
                <h3>{submission.reviewStatus}</h3>
                <p className="ensemble-status">{submission.notes || "No notes yet."}</p>
              </div>
              <p className="ensemble-role">{submission.videoKey ? "Video uploaded" : "No video yet"}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <div>
            <h2>Feedback</h2>
            <p>Review a submission and add feedback for the member.</p>
          </div>
        </div>

        <form className="panel form-panel" onSubmit={handleReviewSubmit}>
          <div className="form-grid">
            <label className="field">
              <span>Submission</span>
              <select
                value={reviewSubmissionId}
                onChange={(event) => setReviewSubmissionId(event.target.value)}
              >
                <option value="">Choose submission</option>
                {remoteSubmissions.map((submission) => (
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
      </section>

      <section className="section">
        <div className="section-header">
          <div>
            <h2>Uploads</h2>
            <p>Practice videos and other files go to S3 through presigned URLs.</p>
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

      <section className="section">
        <div className="panel panel-accent">
          <h2>Status</h2>
          <p>{formMessage}</p>
        </div>
      </section>

    </main>
  );
}

export default App;
