import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  apiUrl,
  createEnsemble,
  createUploadPresign,
  fetchHealthSignal,
  getCurrentProfile,
  listEnsembles,
  upsertProfile,
} from "./lib/api";

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
  const [sessionToken, setSessionToken] = useState("");
  const [tokenDraft, setTokenDraft] = useState("");
  const [profile, setProfile] = useState(placeholderProfile);
  const [remoteEnsembles, setRemoteEnsembles] = useState<Array<{
    ensembleId: string;
    ownerId: string;
    name: string;
    description: string;
    logoKey: string;
  }>>([]);
  const [displayName, setDisplayName] = useState(placeholderProfile.displayName);
  const [email, setEmail] = useState(placeholderProfile.email);
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [ensembleName, setEnsembleName] = useState("New ensemble");
  const [ensembleDescription, setEnsembleDescription] = useState("");
  const [ensembleLogoFile, setEnsembleLogoFile] = useState<File | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadEnsembleId, setUploadEnsembleId] = useState("");
  const [formMessage, setFormMessage] = useState("Add a session token to try the API forms.");
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

    async function loadWorkspace() {
      if (!sessionToken) {
        setProfile(placeholderProfile);
        setRemoteEnsembles([]);
        return;
      }

      try {
        const [profileResponse, ensemblesResponse] = await Promise.all([
          getCurrentProfile(sessionToken),
          listEnsembles(sessionToken),
        ]);

        if (cancelled) return;

        if (profileResponse.profile) {
          setProfile(profileResponse.profile);
          setDisplayName(profileResponse.profile.displayName || "");
          setEmail(profileResponse.profile.email || "");
        }

        setRemoteEnsembles(ensemblesResponse.ensembles);
        setFormMessage("Connected to the API with the current session token.");
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
  }, [sessionToken]);

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
    setSessionToken(tokenDraft.trim());
    setFormMessage(
      tokenDraft.trim()
        ? "Session token set. The workspace will load your profile and ensembles."
        : "Token cleared. The forms will stay in preview mode.",
    );
  }

  async function uploadFileToS3(
    file: File,
    fileType: string,
    ensembleId?: string,
  ) {
    if (!sessionToken) {
      throw new Error("Add a session token first.");
    }

    const presign = await createUploadPresign(sessionToken, {
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

      const result = await upsertProfile(sessionToken, {
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

      const result = await createEnsemble(sessionToken, {
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

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero-topline">
          <p className="eyebrow">EnsembleFlow</p>
          <span className="status-chip">{apiState}</span>
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
            <h2>Session token</h2>
            <p>
              Paste a Cognito access token here when the auth flow is available.
              Until then, the rest of the UI stays in preview mode.
            </p>
          </div>
        </div>

        <form className="panel form-panel" onSubmit={handleApplyToken}>
          <label className="field">
            <span>Access token</span>
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
                setSessionToken("");
                setFormMessage("Token cleared. Preview mode restored.");
              }}
            >
              Clear
            </button>
          </div>
        </form>
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
