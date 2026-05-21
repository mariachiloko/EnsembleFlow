import { useEffect, useMemo, useState } from "react";
import { apiUrl, fetchHealthSignal } from "./lib/api";

const ensembles = [
  {
    name: "Mariachi Los Soles",
    role: "Director",
    sectionCount: 4,
    members: 18,
    status: "3 assignments due",
  },
  {
    name: "West Campus Wind Ensemble",
    role: "Member",
    sectionCount: 6,
    members: 42,
    status: "2 practice videos pending",
  },
  {
    name: "Worship Collective",
    role: "Section lead",
    sectionCount: 5,
    members: 12,
    status: "Feedback waiting",
  },
];

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

function App() {
  const [apiState, setApiState] = useState("Checking backend connection...");

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

  const connectionLabel = useMemo(() => {
    if (!apiUrl) {
      return "API URL not configured";
    }

    return apiUrl;
  }, []);

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
            <h2>Example ensembles</h2>
            <p>Placeholder data that matches the structure the backend will use.</p>
          </div>
        </div>

        <div className="ensemble-list">
          {ensembles.map((ensemble) => (
            <article className="ensemble-row panel" key={ensemble.name}>
              <div>
                <p className="ensemble-role">{ensemble.role}</p>
                <h3>{ensemble.name}</h3>
                <p className="ensemble-status">{ensemble.status}</p>
              </div>
              <dl className="ensemble-metrics">
                <div>
                  <dt>Sections</dt>
                  <dd>{ensemble.sectionCount}</dd>
                </div>
                <div>
                  <dt>Members</dt>
                  <dd>{ensemble.members}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export default App;
