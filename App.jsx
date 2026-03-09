import { useState, useRef } from 'react'

// ── Constants ─────────────────────────────────────────────────────────────────

const STEPS = [
  {
    id: 0,
    label: 'Problem Framing',
    desc: 'Defining scope and research objectives',
    ms: 2400,
  },
  {
    id: 1,
    label: 'Competitor Discovery',
    desc: 'Identifying relevant market players',
    ms: 3000,
  },
  {
    id: 2,
    label: 'Data Collection',
    desc: 'Gathering market and product intelligence',
    ms: 3800,
  },
  {
    id: 3,
    label: 'Comparative Analysis',
    desc: 'Evaluating strengths and market positioning',
    ms: 3200,
  },
  {
    id: 4,
    label: 'Synthesis',
    desc: 'Generating insights and strategic recommendations',
    ms: 2600,
  },
]

const MOCK_COMPETITORS = [
  { name: 'Apex Analytics', tags: ['Enterprise', 'AI-Native'],  threat: 'High',   founded: '2019' },
  { name: 'DataVault Pro',  tags: ['SMB', 'Cloud-First'],       threat: 'Medium', founded: '2021' },
  { name: 'NexusAI',        tags: ['Enterprise', 'ML-Focused'], threat: 'High',   founded: '2018' },
  { name: 'Stratify',       tags: ['Mid-Market'],               threat: 'Medium', founded: '2020' },
  { name: 'Horizon Labs',   tags: ['Niche', 'Startup'],         threat: 'Low',    founded: '2022' },
]

const MOCK_INSIGHTS = [
  'Leading competitors are prioritizing AI-native workflows, with 73% of product updates in Q3 2025 focused on automation and intelligent assistants.',
  'Pricing pressure from new entrants is intensifying in the SMB segment, with average contract values declining 12% year-over-year.',
  'The market is consolidating around 2–3 dominant platforms, while specialized players carve out defensible vertical niches.',
  'Enterprise buyers show 40% longer sales cycles but 3× higher lifetime value compared to SMB customers — a critical segmentation signal.',
]

const MOCK_RECS = [
  {
    title: 'Double Down on Integration Depth',
    body: 'Competitors lack robust API ecosystems. Prioritize developer experience and third-party connectors to create switching costs.',
  },
  {
    title: 'Target the Mid-Market Gap',
    body: 'A significant whitespace exists between lightweight SMB tools and complex enterprise platforms. Position squarely in this segment.',
  },
  {
    title: 'Accelerate AI Roadmap',
    body: 'Market leaders ship AI features quarterly. Matching velocity is table stakes — differentiate on accuracy, explainability, and trust.',
  },
]


// ── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [company, setCompany]             = useState('')
  const [context, setContext]             = useState('')
  const [phase, setPhase]                 = useState('idle')   // 'idle' | 'running' | 'done'
  const [stepStates, setStepStates]       = useState(() => STEPS.map(() => 'idle'))
  const [analysedCompany, setAnalysedCompany] = useState('')
  const timersRef = useRef([])

  const runAnalysis = () => {
    const name = company.trim()
    if (!name) return

    timersRef.current.forEach(clearTimeout)
    timersRef.current = []

    setAnalysedCompany(name)
    setPhase('running')
    setStepStates(STEPS.map(() => 'idle'))

    let delay = 0
    STEPS.forEach((step, i) => {
      // Activate this step
      const tOn = setTimeout(() => {
        setStepStates(prev => prev.map((s, j) => (j === i ? 'active' : s)))
      }, delay)
      timersRef.current.push(tOn)

      delay += step.ms

      // Complete this step (and immediately the next tOn fires via the loop)
      const tOff = setTimeout(() => {
        setStepStates(prev => prev.map((s, j) => (j === i ? 'complete' : s)))
      }, delay)
      timersRef.current.push(tOff)
    })

    const totalMs = STEPS.reduce((acc, s) => acc + s.ms, 0)
    const tDone = setTimeout(() => setPhase('done'), totalMs + 80)
    timersRef.current.push(tDone)
  }

  const reset = () => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    setPhase('idle')
    setStepStates(STEPS.map(() => 'idle'))
    setCompany('')
    setContext('')
    setAnalysedCompany('')
  }

  const activeStep = STEPS[stepStates.indexOf('active')] ?? null

  return (
    <div className="app">
      <AppHeader />
      <div className="workspace">
        <aside className="left-panel">
          <InputForm
            company={company}
            context={context}
            setCompany={setCompany}
            setContext={setContext}
            onSubmit={runAnalysis}
            onReset={reset}
            phase={phase}
          />
          <div className="section-divider" />
          <ProgressTracker steps={STEPS} stepStates={stepStates} />
        </aside>

        <main className="right-panel">
          <OutputPanel
            phase={phase}
            company={analysedCompany}
            activeStep={activeStep}
          />
        </main>
      </div>
    </div>
  )
}


// ── Header ────────────────────────────────────────────────────────────────────

function AppHeader() {
  return (
    <header className="header">
      <div className="header-brand">
        <div className="header-icon">
          <SearchIcon size={15} />
        </div>
        <span className="header-title">Competitive Intelligence</span>
        <span className="header-badge">Agent</span>
      </div>
      <div className="header-meta">
        <span className="status-dot" />
        <span>Research Mode</span>
      </div>
    </header>
  )
}


// ── Input Form ────────────────────────────────────────────────────────────────

function InputForm({ company, context, setCompany, setContext, onSubmit, onReset, phase }) {
  const isRunning = phase === 'running'
  const isDone    = phase === 'done'

  return (
    <div className="input-form">
      <div>
        <h2 className="form-title">Research Target</h2>
        <p className="form-subtitle">Configure your competitive analysis</p>
      </div>

      <div className="form-fields">
        <div className="field">
          <label className="field-label">
            Company Name <span className="required">*</span>
          </label>
          <input
            className="field-input"
            type="text"
            placeholder="e.g. Salesforce, Notion, Linear…"
            value={company}
            onChange={e => setCompany(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !isRunning && !isDone && onSubmit()}
            disabled={isRunning || isDone}
          />
        </div>

        <div className="field">
          <label className="field-label">
            Research Context <span className="optional">optional</span>
          </label>
          <textarea
            className="field-textarea"
            placeholder="Describe your use case, target market, or specific angles to investigate…"
            value={context}
            onChange={e => setContext(e.target.value)}
            disabled={isRunning || isDone}
            rows={3}
          />
        </div>
      </div>

      <div>
        {isDone ? (
          <button className="btn btn-reset" onClick={onReset}>
            <ResetIcon size={13} />
            New Analysis
          </button>
        ) : (
          <button
            className={`btn btn-primary${isRunning ? ' btn-loading' : ''}`}
            onClick={onSubmit}
            disabled={isRunning || !company.trim()}
          >
            {isRunning ? (
              <>
                <span className="btn-spinner" />
                Analyzing…
              </>
            ) : (
              <>
                <PlayIcon size={13} />
                Run Analysis
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}


// ── Progress Tracker ──────────────────────────────────────────────────────────

function ProgressTracker({ steps, stepStates }) {
  const completedCount = stepStates.filter(s => s === 'complete').length
  const allDone        = completedCount === steps.length

  return (
    <div className="progress-tracker">
      <div className="tracker-header">
        <span className="tracker-label">Analysis Pipeline</span>
        <span className={`tracker-count${allDone ? ' all-done' : ''}`}>
          {completedCount}/{steps.length}
        </span>
      </div>

      <div className="tracker-steps">
        {steps.map((step, i) => (
          <StepItem
            key={step.id}
            step={step}
            state={stepStates[i]}
            isLast={i === steps.length - 1}
          />
        ))}
      </div>
    </div>
  )
}

function StepItem({ step, state, isLast }) {
  return (
    <div className={`step-item step-${state}`}>
      <div className="step-left">
        <div className="step-circle">
          {state === 'complete' && <CheckIcon size={13} />}
          {state === 'active'   && <div className="step-spinner" />}
          {state === 'idle'     && <span className="step-number">{step.id + 1}</span>}
          {state === 'active'   && <div className="step-pulse-ring" />}
        </div>
        {!isLast && <div className="step-connector" />}
      </div>

      <div className="step-content">
        <div className="step-label">{step.label}</div>
        <div className="step-desc">{step.desc}</div>
      </div>
    </div>
  )
}


// ── Output Panel ──────────────────────────────────────────────────────────────

function OutputPanel({ phase, company, activeStep }) {
  if (phase === 'idle') {
    return (
      <div className="output-panel output-idle">
        <div className="idle-inner">
          <div className="idle-icon-wrap">
            <SearchIcon size={38} />
          </div>
          <h3 className="idle-title">Ready to Research</h3>
          <p className="idle-body">
            Enter a company name and run your first competitive analysis.
            Results will appear here.
          </p>
          <div className="idle-chips">
            {['Competitor discovery', 'Market positioning', 'Strategic insights'].map(label => (
              <span key={label} className="idle-chip">
                <span className="idle-chip-dot" />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'running') {
    return (
      <div className="output-panel output-running">
        <div className="running-header">
          <div className="running-eyebrow">Analyzing</div>
          <div className="running-company">{company}</div>
          <div className="running-status-row">
            <span className="running-dot" />
            <span>
              {activeStep ? `${activeStep.label}…` : 'Finalizing…'}
            </span>
          </div>
        </div>

        <div className="skeleton-stack">
          {[0, 1, 2].map(i => (
            <div key={i} className="skeleton-card">
              <div className="skel skel-w70" style={{ animationDelay: `${i * 0.12}s` }} />
              <div className="skel skel-w50" style={{ animationDelay: `${i * 0.12 + 0.1}s` }} />
              <div className="skel skel-w35" style={{ animationDelay: `${i * 0.12 + 0.2}s` }} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Done — render the mock report
  return (
    <div className="output-panel output-done">
      <div className="report-header">
        <div className="report-title-row">
          <div>
            <div className="report-eyebrow">Competitive Analysis Report</div>
            <h2 className="report-company">{company}</h2>
          </div>
          <div className="report-meta-col">
            <span className="report-badge">Complete</span>
            <span className="report-date">
              {new Date().toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })}
            </span>
          </div>
        </div>

        <div className="report-stats">
          <Stat value="5"    label="Competitors" />
          <Stat value="847"  label="Data Points" />
          <Stat value="12"   label="Insights" />
          <Stat value="94%"  label="Coverage" />
        </div>
      </div>

      <div className="report-body">
        <section>
          <h3 className="report-section-title">Competitors Identified</h3>
          <div className="competitors-grid">
            {MOCK_COMPETITORS.map((c, i) => (
              <CompetitorCard
                key={c.name}
                competitor={c}
                style={{ animationDelay: `${i * 70}ms` }}
              />
            ))}
          </div>
        </section>

        <section>
          <h3 className="report-section-title">Key Market Insights</h3>
          <div className="insights-list">
            {MOCK_INSIGHTS.map((text, i) => (
              <div
                key={i}
                className="insight-item"
                style={{ animationDelay: `${i * 90 + 120}ms` }}
              >
                <span className="insight-bullet" />
                <p className="insight-text">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="report-section-title">Strategic Recommendations</h3>
          <div className="recs-grid">
            {MOCK_RECS.map((r, i) => (
              <div
                key={r.title}
                className="rec-card"
                style={{ animationDelay: `${i * 90 + 300}ms` }}
              >
                <div className="rec-number">0{i + 1}</div>
                <div className="rec-title">{r.title}</div>
                <div className="rec-body">{r.body}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}


// ── Sub-components ────────────────────────────────────────────────────────────

function Stat({ value, label }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  )
}

function CompetitorCard({ competitor, style }) {
  const threatClass = {
    High: 'threat-high', Medium: 'threat-medium', Low: 'threat-low',
  }[competitor.threat]

  return (
    <div className="competitor-card" style={style}>
      <div className="cc-top">
        <div className="cc-avatar">{competitor.name.charAt(0)}</div>
        <span className={`cc-threat ${threatClass}`}>{competitor.threat}</span>
      </div>
      <div className="cc-name">{competitor.name}</div>
      <div className="cc-founded">Est. {competitor.founded}</div>
      <div className="cc-tags">
        {competitor.tags.map(t => (
          <span key={t} className="cc-tag">{t}</span>
        ))}
      </div>
    </div>
  )
}


// ── Inline SVG Icons ──────────────────────────────────────────────────────────

function SearchIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}

function CheckIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function PlayIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
}

function ResetIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  )
}
