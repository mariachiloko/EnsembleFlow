const highlights = [
  {
    title: "Private profiles",
    body: "Each user can keep their own profile, picture, and ensemble memberships.",
  },
  {
    title: "Multiple ensembles",
    body: "A single account can manage more than one group, each with its own sections.",
  },
  {
    title: "Direct uploads",
    body: "Photos, logos, and videos are uploaded to S3 through signed URLs.",
  },
];

const phases = [
  "Auth foundation",
  "Profile data",
  "Ensemble setup",
  "Upload flow",
  "Assignment tracking",
];

function App() {
  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">EnsembleFlow</p>
        <h1>Rehearsal accountability for real music groups.</h1>
        <p className="lede">
          A portfolio SaaS scaffold for ensembles that need profile management,
          section organization, and private uploads without extra complexity.
        </p>
        <div className="hero-grid">
          <article className="panel panel-accent">
            <h2>What this will show</h2>
            <ul className="checklist">
              <li>Authentication</li>
              <li>Private user data</li>
              <li>S3-based uploads</li>
              <li>Serverless backend design</li>
            </ul>
          </article>
          <article className="panel">
            <h2>Phase 1 focus</h2>
            <ol className="phase-list">
              {phases.map((phase) => (
                <li key={phase}>{phase}</li>
              ))}
            </ol>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>Core ideas</h2>
          <p>Simple product decisions that keep the app cheap and practical.</p>
        </div>
        <div className="card-grid">
          {highlights.map((item) => (
            <article className="panel" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export default App;

