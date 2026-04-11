const proofPoints = [
  'Text-first interview sessions',
  'Async evaluation pipeline',
  'Structured feedback reports',
]

const workflow = [
  {
    step: 'Create session',
    detail: 'Persist a template-backed mock interview with role context and snapshot the question set.',
  },
  {
    step: 'Collect answers',
    detail: 'Accept idempotent text submissions and keep the candidate flow responsive.',
  },
  {
    step: 'Score asynchronously',
    detail: 'Queue evaluation jobs, write structured feedback, and update the session status.',
  },
]

const capabilities = [
  {
    title: 'Interview sessions',
    detail: 'Create and review mock interview runs without pretending to support live video.',
  },
  {
    title: 'Evaluation pipeline',
    detail: 'Dispatch scoring work through a DB-backed async workflow with a clean provider seam.',
  },
  {
    title: 'Admin inspection',
    detail: 'Expose normalized results for dashboards, QA, and operator review.',
  },
]

const routes = [
  '/api/auth/[...nextauth]',
  '/api/auth/register',
  '/api/interview-sessions',
  '/api/interview-sessions/[sessionId]/answers',
  '/api/admin/interview-sessions',
]

const rubric = [
  { label: 'Clarity', score: 82 },
  { label: 'Structure', score: 79 },
  { label: 'Specificity', score: 74 },
  { label: 'Judgment', score: 77 },
  { label: 'Communication', score: 84 },
]

const commands = ['npm run db:seed', 'npm run dev', 'npm run worker']

const credentials = [
  {
    role: 'Admin',
    email: 'admin@prep.local',
    password: 'admin1234',
  },
  {
    role: 'User',
    email: 'demo@prep.local',
    password: 'demo1234',
  },
]

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">HireVue-style interview practice API</p>
          <h1>Backend for mock interviews, scoring, and structured feedback</h1>
          <p className="lede">
            A text-first backend for running interview sessions, evaluating answers asynchronously, and
            reviewing results through admin tooling.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#flow">
              View API capabilities
            </a>
            <a className="button button-secondary" href="#demo">
              See backend flow
            </a>
          </div>
          <ul className="proof-list">
            {proofPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <p className="hero-note">
            Built for product demos, collaborator reviews, and honest backend conversations.
          </p>
        </div>

        <div className="hero-visual" aria-label="Session snapshot">
          <div className="snapshot-shell">
            <div className="snapshot-top">
              <span className="status-pill">
                <span className="status-dot" />
                queued evaluation
              </span>
              <span className="snapshot-meta">session / answer / report</span>
            </div>

            <div className="snapshot-stack">
              <article className="snapshot-card">
                <p className="card-label">Question</p>
                <h2>How would you approach a 15 percent profit drop?</h2>
                <p>
                  Use a clean issue tree, separate revenue from cost, and explain the data you would request
                  first.
                </p>
              </article>

              <article className="snapshot-card snapshot-card-dark">
                <p className="card-label">Candidate answer</p>
                <p>
                  “I’d split the problem into volume, price, and cost drivers, then isolate which line changed
                  first.”
                </p>
              </article>

              <article className="snapshot-card snapshot-card-grid">
                <div>
                  <p className="card-label">Structured feedback</p>
                  <p className="summary">
                    Clarity, structure, specificity, business judgment, communication.
                  </p>
                </div>
                <div className="score-grid" aria-label="Rubric scores">
                  {rubric.map((item) => (
                    <div key={item.label} className="score-row">
                      <div className="score-row-label">
                        <span>{item.label}</span>
                        <strong>{item.score}</strong>
                      </div>
                      <div className="score-bar">
                        <span style={{ width: `${item.score}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="flow">
        <div className="section-header">
          <p className="eyebrow">How it works</p>
          <h2>Three steps, one real backend loop.</h2>
          <p>
            Sessions are created, answers are stored, and evaluation runs asynchronously through the job table
            and worker.
          </p>
        </div>

        <div className="workflow-grid">
          {workflow.map((item, index) => (
            <article key={item.step} className="workflow-card">
              <p className="workflow-index">0{index + 1}</p>
              <h3>{item.step}</h3>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <p className="eyebrow">Core capabilities</p>
          <h2>Small surface area, clear operator model.</h2>
          <p>Enough to demo product realism without pretending to have a full media pipeline.</p>
        </div>

        <div className="capability-grid">
          {capabilities.map((item) => (
            <article key={item.title} className="capability-card">
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>

        <div className="surface-strip">
          <div>
            <p className="strip-label">API surface</p>
            <div className="route-list" aria-label="API routes">
              {routes.map((route) => (
                <code key={route}>{route}</code>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="demo">
        <div className="section-header">
          <p className="eyebrow">Demo kit</p>
          <h2>Run it locally or push it to Cloud Run later.</h2>
          <p>
            Seeded users and templates make the first login path real. Everything stays text-first for this
            MVP.
          </p>
        </div>

        <div className="demo-grid">
          <article className="terminal-card">
            <p className="card-label">Commands</p>
            <pre>{commands.join('\n')}</pre>
          </article>

          <article className="terminal-card">
            <p className="card-label">Seeded login</p>
            <div className="credential-list">
              {credentials.map((credential) => (
                <div key={credential.role} className="credential-row">
                  <div>
                    <strong>{credential.role}</strong>
                    <p>{credential.email}</p>
                  </div>
                  <code>{credential.password}</code>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <footer className="footer">
        Designed as a standalone backend MVP for interview practice and evaluation workflows.
      </footer>
    </main>
  )
}
