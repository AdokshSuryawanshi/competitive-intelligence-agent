import { useState, useRef, useCallback } from "react";

// ── API Helper ───────────────────────────────────────────────────────────────

async function callClaude(systemPrompt, userMessage, useWebSearch = false) {
  const body = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  };
  if (useWebSearch) {
    body.tools = [{ type: "web_search_20250305", name: "web_search" }];
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  return data.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

// ── Step Prompts ─────────────────────────────────────────────────────────────

const SYSTEM_BASE =
  "You are a senior competitive intelligence analyst. Be specific, data-driven, and concise. Always respond in valid JSON only — no markdown, no backticks, no preamble.";

function step1Prompt(company, context) {
  return {
    system: SYSTEM_BASE,
    user: `Analyze this company for competitive research:
Company: ${company}
${context ? `Additional context: ${context}` : ""}

Return JSON:
{
  "category": "product category",
  "market": "target market description",
  "dimensions": ["dimension1", "dimension2", "dimension3", "dimension4", "dimension5"],
  "summary": "1-2 sentence framing of the competitive landscape"
}

The dimensions should be the most important axes for comparing competitors (e.g. pricing model, target segment, core technology, distribution, etc). Pick dimensions specific to this company's space.`,
  };
}

function step2Prompt(company, step1Data) {
  return {
    system: SYSTEM_BASE + " Use web search to find current, real competitors.",
    user: `Find 4-6 key competitors for:
Company: ${company}
Category: ${step1Data.category}
Market: ${step1Data.market}

Search the web for real competitors. Include both direct competitors and adjacent/emerging threats.

Return JSON:
{
  "competitors": [
    {
      "name": "company name",
      "description": "1 sentence what they do",
      "rationale": "why they're a competitor",
      "threat_level": "High|Medium|Low"
    }
  ]
}`,
  };
}

function step3Prompt(company, step1Data, step2Data) {
  const names = step2Data.competitors.map((c) => c.name).join(", ");
  return {
    system:
      SYSTEM_BASE +
      " Use web search to find current data on each competitor. Be factual.",
    user: `Collect detailed intelligence on these competitors to ${company}:
Competitors: ${names}
Category: ${step1Data.category}
Dimensions to cover: ${step1Data.dimensions.join(", ")}

For each competitor, search the web and gather real data.

Return JSON:
{
  "profiles": [
    {
      "name": "company name",
      "positioning": "how they position themselves",
      "pricing": "pricing model and approximate price points",
      "key_features": ["feature1", "feature2", "feature3"],
      "target_audience": "who they sell to",
      "strengths": ["strength1", "strength2"],
      "weaknesses": ["weakness1", "weakness2"],
      "recent_moves": "any recent strategic moves, launches, or news"
    }
  ]
}`,
  };
}

function step4Prompt(company, step1Data, step2Data, step3Data) {
  return {
    system: SYSTEM_BASE,
    user: `Perform comparative analysis for ${company} against competitors.

Framing: ${JSON.stringify(step1Data)}
Competitors: ${JSON.stringify(step2Data.competitors.map((c) => c.name))}
Profiles: ${JSON.stringify(step3Data.profiles)}

Compare across these dimensions: ${step1Data.dimensions.join(", ")}

Return JSON:
{
  "comparison_matrix": [
    {
      "company": "name",
      "scores": {"dimension1": "brief assessment", "dimension2": "brief assessment"}
    }
  ],
  "clusters": ["description of competitive cluster 1", "cluster 2"],
  "gaps": ["whitespace/gap opportunity 1", "gap 2", "gap 3"],
  "key_insight": "the single most important competitive insight"
}`,
  };
}

function step5Prompt(company, step1Data, step2Data, step3Data, step4Data) {
  return {
    system:
      "You are a senior competitive intelligence analyst writing an executive report. Respond in valid JSON only — no markdown, no backticks.",
    user: `Synthesize a competitive landscape report for ${company}.

Category: ${step1Data.category}
Market: ${step1Data.market}
Competitors: ${JSON.stringify(step2Data.competitors)}
Profiles: ${JSON.stringify(step3Data.profiles)}
Analysis: ${JSON.stringify(step4Data)}

Return JSON:
{
  "executive_summary": "3-4 sentence overview of the competitive landscape",
  "market_insights": ["insight1", "insight2", "insight3", "insight4"],
  "recommendations": [
    {"title": "recommendation title", "body": "2-3 sentence explanation"},
    {"title": "recommendation title", "body": "2-3 sentence explanation"},
    {"title": "recommendation title", "body": "2-3 sentence explanation"}
  ],
  "risk_factors": ["risk1", "risk2"],
  "outlook": "2-3 sentence forward-looking perspective"
}`,
  };
}

// ── Parse helper ─────────────────────────────────────────────────────────────

function parseJSON(text) {
  const clean = text
    .replace(/```json\s*/g, "")
    .replace(/```/g, "")
    .trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON found in response");
  return JSON.parse(clean.slice(start, end + 1));
}

// ── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  { id: "framing", label: "Problem Framing", desc: "Defining scope and research dimensions" },
  { id: "discovery", label: "Competitor Discovery", desc: "Identifying key market players" },
  { id: "collection", label: "Data Collection", desc: "Gathering positioning and feature intel" },
  { id: "analysis", label: "Comparative Analysis", desc: "Mapping strengths and market gaps" },
  { id: "synthesis", label: "Synthesis", desc: "Generating strategic recommendations" },
];

// ── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [company, setCompany] = useState("");
  const [context, setContext] = useState("");
  const [phase, setPhase] = useState("idle");
  const [stepStates, setStepStates] = useState(STEPS.map(() => "idle"));
  const [stepPreviews, setStepPreviews] = useState({});
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState(null);
  const abortRef = useRef(false);

  const setStep = (index, state) =>
    setStepStates((prev) => prev.map((s, i) => (i === index ? state : s)));

  const setPreview = (id, text) =>
    setStepPreviews((prev) => ({ ...prev, [id]: text }));

  const runAnalysis = useCallback(async () => {
    if (!company.trim()) return;
    abortRef.current = false;
    setPhase("running");
    setStepStates(STEPS.map(() => "idle"));
    setStepPreviews({});
    setReportData(null);
    setError(null);

    try {
      // Step 1: Problem Framing
      setStep(0, "active");
      const p1 = step1Prompt(company, context);
      const r1 = await callClaude(p1.system, p1.user);
      const d1 = parseJSON(r1);
      setPreview("framing", `${d1.category} · ${d1.dimensions.length} dimensions identified`);
      setStep(0, "complete");
      if (abortRef.current) return;

      // Step 2: Competitor Discovery
      setStep(1, "active");
      const p2 = step2Prompt(company, d1);
      const r2 = await callClaude(p2.system, p2.user, true);
      const d2 = parseJSON(r2);
      setPreview("discovery", `${d2.competitors.length} competitors: ${d2.competitors.map((c) => c.name).join(", ")}`);
      setStep(1, "complete");
      if (abortRef.current) return;

      // Step 3: Data Collection
      setStep(2, "active");
      const p3 = step3Prompt(company, d1, d2);
      const r3 = await callClaude(p3.system, p3.user, true);
      const d3 = parseJSON(r3);
      setPreview("collection", `Profiled ${d3.profiles.length} competitors across pricing, features, positioning`);
      setStep(2, "complete");
      if (abortRef.current) return;

      // Step 4: Comparative Analysis
      setStep(3, "active");
      const p4 = step4Prompt(company, d1, d2, d3);
      const r4 = await callClaude(p4.system, p4.user);
      const d4 = parseJSON(r4);
      setPreview("analysis", `${d4.gaps.length} gaps identified · ${d4.clusters.length} competitive clusters`);
      setStep(3, "complete");
      if (abortRef.current) return;

      // Step 5: Synthesis
      setStep(4, "active");
      const p5 = step5Prompt(company, d1, d2, d3, d4);
      const r5 = await callClaude(p5.system, p5.user);
      const d5 = parseJSON(r5);
      setStep(4, "complete");

      setReportData({
        company: company.trim(),
        framing: d1,
        competitors: d2.competitors,
        profiles: d3.profiles,
        analysis: d4,
        synthesis: d5,
      });
      setPhase("done");
    } catch (err) {
      setError(err.message);
      setPhase("error");
    }
  }, [company, context]);

  const reset = () => {
    abortRef.current = true;
    setPhase("idle");
    setStepStates(STEPS.map(() => "idle"));
    setStepPreviews({});
    setReportData(null);
    setError(null);
    setCompany("");
    setContext("");
  };

  return (
    <div style={styles.app}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        input:focus, textarea:focus {
          border-color: rgba(124,109,255,0.5) !important;
          box-shadow: 0 0 0 3px rgba(124,109,255,0.1) !important;
          outline: none;
        }
        button:hover { filter: brightness(1.1); }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.09); border-radius: 3px; }
      `}</style>
      <Header />
      <div style={styles.workspace}>
        <aside style={styles.leftPanel}>
          <InputForm
            company={company}
            context={context}
            setCompany={setCompany}
            setContext={setContext}
            onSubmit={runAnalysis}
            onReset={reset}
            phase={phase}
          />
          <div style={styles.divider} />
          <ProgressTracker steps={STEPS} states={stepStates} previews={stepPreviews} />
          {error && (
            <div style={styles.errorBox}>
              <span style={{ fontWeight: 700 }}>Error:</span> {error}
            </div>
          )}
        </aside>
        <main style={styles.rightPanel}>
          <OutputPanel phase={phase} data={reportData} />
        </main>
      </div>
    </div>
  );
}

// ── Header ───────────────────────────────────────────────────────────────────

function Header() {
  return (
    <header style={styles.header}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={styles.headerIcon}>
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#eeeef8" }}>Competitive Intelligence</span>
        <span style={styles.headerBadge}>Agent</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "#7e7ea8" }}>
        <div style={styles.statusDot} />
        <span>Research Mode</span>
      </div>
    </header>
  );
}

// ── Input Form ───────────────────────────────────────────────────────────────

function InputForm({ company, context, setCompany, setContext, onSubmit, onReset, phase }) {
  const disabled = phase === "running" || phase === "done" || phase === "error";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "#eeeef8", marginBottom: 2 }}>Research Target</h2>
        <p style={{ fontSize: 12, color: "#7e7ea8" }}>Configure your competitive analysis</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        <div style={styles.field}>
          <label style={styles.label}>Company Name <span style={{ color: "#f87171" }}>*</span></label>
          <input
            style={{ ...styles.input, opacity: disabled ? 0.45 : 1 }}
            placeholder="e.g. WHOOP, Notion, Linear…"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !disabled && onSubmit()}
            disabled={disabled}
          />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>
            Research Context <span style={styles.optional}>optional</span>
          </label>
          <textarea
            style={{ ...styles.textarea, opacity: disabled ? 0.45 : 1 }}
            placeholder="e.g. consumer wearables, fitness-focused…"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            disabled={disabled}
            rows={2}
          />
        </div>
      </div>
      {disabled && phase !== "running" ? (
        <button style={styles.btnReset} onClick={onReset}>New Analysis</button>
      ) : (
        <button
          style={{ ...styles.btnPrimary, opacity: phase === "running" || !company.trim() ? 0.5 : 1, cursor: phase === "running" || !company.trim() ? "not-allowed" : "pointer" }}
          onClick={onSubmit}
          disabled={phase === "running" || !company.trim()}
        >
          {phase === "running" ? "Analyzing…" : "Run Analysis"}
        </button>
      )}
    </div>
  );
}

// ── Progress Tracker ─────────────────────────────────────────────────────────

function ProgressTracker({ steps, states, previews }) {
  const done = states.filter((s) => s === "complete").length;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={styles.trackerLabel}>Analysis Pipeline</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: done === steps.length ? "rgba(52,211,153,0.7)" : "#3c3c5a", fontVariantNumeric: "tabular-nums" }}>
          {done}/{steps.length}
        </span>
      </div>
      {steps.map((step, i) => {
        const state = states[i];
        const circleStyle = state === "active" ? styles.circleActive : state === "complete" ? styles.circleComplete : styles.circleIdle;
        const nums = { framing: "1", discovery: "2", collection: "3", analysis: "4", synthesis: "5" };
        return (
          <div key={step.id} style={{ display: "flex", gap: 11 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 34 }}>
              <div style={circleStyle}>
                {state === "complete" ? "✓" : state === "active" ? "⟳" : nums[step.id]}
              </div>
              {i < steps.length - 1 && (
                <div style={{
                  width: 2, flex: 1, minHeight: 14, margin: "3px 0", borderRadius: 1,
                  background: state === "complete" ? "rgba(52,211,153,0.7)" : "rgba(255,255,255,0.05)",
                  transition: "background 400ms ease",
                }} />
              )}
            </div>
            <div style={{ paddingTop: 6, paddingBottom: 18, flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: state === "active" ? "#eeeef8" : "#7e7ea8" }}>{step.label}</div>
              <div style={{ fontSize: 11, marginTop: 2, color: state === "active" ? "#7e7ea8" : "#3c3c5a" }}>{step.desc}</div>
              {previews[step.id] && <div style={styles.preview}>{previews[step.id]}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Output Panel ─────────────────────────────────────────────────────────────

function OutputPanel({ phase, data }) {
  if (phase === "idle") {
    return (
      <div style={styles.centered}>
        <div style={{ fontSize: 48, opacity: 0.15, marginBottom: 16 }}>◇</div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: "#eeeef8", marginBottom: 8 }}>Ready to Research</h3>
        <p style={{ fontSize: 13, color: "#7e7ea8", lineHeight: 1.6, maxWidth: 340, textAlign: "center" }}>
          Enter a company name and run your first competitive analysis. The agent will search the web and generate a full landscape report.
        </p>
      </div>
    );
  }

  if (phase === "running") {
    return (
      <div style={{ padding: "40px 36px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(124,109,255,0.65)", marginBottom: 8 }}>
          Researching
        </div>
        <div style={{ fontSize: 14, color: "#7e7ea8", marginBottom: 28 }}>Agent is analyzing the competitive landscape…</div>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ ...styles.skeletonCard, marginBottom: 14 }}>
            <div style={{ ...styles.skel, width: "70%" }} />
            <div style={{ ...styles.skel, width: "50%" }} />
            <div style={{ ...styles.skel, width: "35%" }} />
          </div>
        ))}
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div style={styles.centered}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚠</div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: "#f87171", marginBottom: 8 }}>Analysis Failed</h3>
        <p style={{ fontSize: 13, color: "#7e7ea8", textAlign: "center" }}>Something went wrong. Hit "New Analysis" to try again.</p>
      </div>
    );
  }

  if (!data) return null;
  const { company, framing, competitors, profiles, analysis, synthesis } = data;

  return (
    <div style={{ animation: "fadeIn 0.4s ease both" }}>
      {/* Header */}
      <div style={styles.reportHeader}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "rgba(124,109,255,0.65)", marginBottom: 5 }}>
              Competitive Analysis Report
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 800, color: "#eeeef8", letterSpacing: "-0.025em" }}>{company}</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 7 }}>
            <span style={styles.completeBadge}>Complete</span>
            <span style={{ fontSize: 11, color: "#3c3c5a" }}>
              {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 28 }}>
          <Stat value={competitors.length} label="Competitors" />
          <Stat value={framing.dimensions.length} label="Dimensions" />
          <Stat value={synthesis.market_insights.length} label="Insights" />
          <Stat value={synthesis.recommendations.length} label="Recs" />
        </div>
      </div>

      <div style={{ padding: "28px 36px", display: "flex", flexDirection: "column", gap: 34 }}>
        {/* Executive Summary */}
        <Section title="Executive Summary">
          <p style={styles.bodyText}>{synthesis.executive_summary}</p>
          <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(124,109,255,0.06)", border: "1px solid rgba(124,109,255,0.15)", borderRadius: 8 }}>
            <span style={{ fontSize: 13, color: "#eeeef8" }}>{framing.category}</span>
            <span style={{ margin: "0 8px", color: "#3c3c5a" }}>·</span>
            <span style={{ fontSize: 12, color: "#7e7ea8" }}>{framing.market}</span>
          </div>
        </Section>

        {/* Competitors */}
        <Section title="Competitors Identified">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 }}>
            {profiles.map((p, i) => (
              <CompCard key={i} profile={p} threat={competitors[i]?.threat_level || "Medium"} />
            ))}
          </div>
        </Section>

        {/* Comparison Table */}
        {analysis.comparison_matrix && (
          <Section title="Competitive Comparison">
            <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid rgba(255,255,255,0.05)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                    <th style={styles.th}>Company</th>
                    {framing.dimensions.map((d) => <th key={d} style={styles.th}>{d}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {analysis.comparison_matrix.map((row, i) => (
                    <tr key={i}>
                      <td style={{ ...styles.td, fontWeight: 700, color: "#eeeef8" }}>{row.company}</td>
                      {framing.dimensions.map((d) => <td key={d} style={styles.td}>{row.scores?.[d] || "—"}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* Gaps */}
        <Section title="Market Gaps & Whitespace">
          {analysis.gaps.map((g, i) => (
            <Insight key={i} text={g} />
          ))}
        </Section>

        {/* Key Insights */}
        <Section title="Key Market Insights">
          {synthesis.market_insights.map((ins, i) => (
            <Insight key={i} text={ins} />
          ))}
        </Section>

        {/* Recs */}
        <Section title="Strategic Recommendations">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {synthesis.recommendations.map((r, i) => (
              <div key={i} style={styles.recCard}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(124,109,255,0.65)", marginBottom: 9 }}>0{i + 1}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#eeeef8", marginBottom: 6, lineHeight: 1.35 }}>{r.title}</div>
                <div style={{ fontSize: 12, color: "#7e7ea8", lineHeight: 1.65 }}>{r.body}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Risks */}
        <Section title="Risk Factors">
          {synthesis.risk_factors.map((r, i) => (
            <Insight key={i} text={r} dotColor="#f87171" />
          ))}
        </Section>

        {/* Outlook */}
        <Section title="Outlook">
          <p style={styles.bodyText}>{synthesis.outlook}</p>
        </Section>
      </div>
    </div>
  );
}

// ── Shared Components ────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <section>
      <h3 style={styles.sectionTitle}>{title}</h3>
      {children}
    </section>
  );
}

function Stat({ value, label }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#eeeef8", letterSpacing: "-0.03em", lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 10, color: "#3c3c5a", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{label}</div>
    </div>
  );
}

function Insight({ text, dotColor = "rgba(124,109,255,0.65)" }) {
  return (
    <div style={styles.insightRow}>
      <span style={{ ...styles.insightDot, background: dotColor }} />
      <p style={{ fontSize: 12.5, color: "#7e7ea8", lineHeight: 1.65, margin: 0 }}>{text}</p>
    </div>
  );
}

function CompCard({ profile, threat }) {
  const tc = {
    High: { bg: "rgba(248,113,113,0.12)", color: "#f87171", border: "rgba(248,113,113,0.22)" },
    Medium: { bg: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "rgba(251,191,36,0.22)" },
    Low: { bg: "rgba(52,211,153,0.08)", color: "#34d399", border: "rgba(52,211,153,0.22)" },
  }[threat] || { bg: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "rgba(251,191,36,0.22)" };

  return (
    <div style={styles.compCard}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={styles.avatar}>{profile.name.charAt(0)}</div>
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", padding: "2px 7px", borderRadius: 99, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>{threat}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#eeeef8", marginBottom: 2 }}>{profile.name}</div>
      <div style={{ fontSize: 11, color: "#3c3c5a", marginBottom: 6 }}>{profile.positioning}</div>
      <div style={{ fontSize: 11, color: "#7e7ea8", marginBottom: 8 }}>{profile.pricing}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {(profile.key_features || []).slice(0, 3).map((f) => (
          <span key={f} style={styles.tag}>{f}</span>
        ))}
      </div>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  app: { display: "flex", flexDirection: "column", height: "100vh", background: "#080a13", color: "#eeeef8", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", fontSize: 14, lineHeight: 1.5 },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", height: 52, background: "linear-gradient(180deg, rgba(124,109,255,0.04) 0%, transparent 100%), #0c0f1e", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 },
  headerIcon: { width: 30, height: 30, background: "rgba(124,109,255,0.22)", border: "1px solid rgba(124,109,255,0.25)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: "#7c6dff" },
  headerBadge: { fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", background: "rgba(124,109,255,0.22)", color: "#7c6dff", border: "1px solid rgba(124,109,255,0.28)", padding: "2px 7px", borderRadius: 99 },
  statusDot: { width: 7, height: 7, background: "#34d399", borderRadius: "50%", boxShadow: "0 0 8px #34d399" },
  workspace: { display: "flex", flex: 1, overflow: "hidden", minHeight: 0 },
  leftPanel: { width: 348, flexShrink: 0, background: "#0c0f1e", borderRight: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", overflowY: "auto", padding: "22px 20px" },
  rightPanel: { flex: 1, overflowY: "auto", background: "#080a13" },
  divider: { height: 1, background: "rgba(255,255,255,0.05)", margin: "22px 0" },
  field: { display: "flex", flexDirection: "column", gap: 5 },
  label: { fontSize: 11.5, fontWeight: 600, color: "#7e7ea8", display: "flex", alignItems: "center", gap: 5 },
  optional: { fontWeight: 400, fontSize: 10.5, color: "#3c3c5a", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.05)", padding: "1px 5px", borderRadius: 4 },
  input: { background: "#090c1a", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 6, padding: "9px 12px", color: "#eeeef8", fontSize: 13, fontFamily: "inherit", width: "100%" },
  textarea: { background: "#090c1a", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 6, padding: "9px 12px", color: "#eeeef8", fontSize: 13, fontFamily: "inherit", resize: "none", width: "100%" },
  btnPrimary: { background: "linear-gradient(135deg, #7c6dff 0%, #5243cc 100%)", color: "#fff", border: "none", borderRadius: 6, padding: "9px 16px", fontSize: 13, fontWeight: 600, width: "100%", fontFamily: "inherit" },
  btnReset: { background: "#101427", color: "#7e7ea8", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 6, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", width: "100%", fontFamily: "inherit" },
  trackerLabel: { fontSize: 10.5, fontWeight: 700, color: "#7e7ea8", textTransform: "uppercase", letterSpacing: "0.08em" },
  circleIdle: { width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.03)", border: "1.5px solid rgba(255,255,255,0.09)", color: "#3c3c5a", fontSize: 11.5, fontWeight: 700, flexShrink: 0 },
  circleActive: { width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(124,109,255,0.22)", border: "1.5px solid rgba(124,109,255,0.55)", color: "#7c6dff", fontSize: 12, fontWeight: 700, boxShadow: "0 0 0 4px rgba(124,109,255,0.1)", flexShrink: 0 },
  circleComplete: { width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(52,211,153,0.18)", border: "1.5px solid rgba(52,211,153,0.5)", color: "#34d399", fontSize: 13, fontWeight: 700, boxShadow: "0 0 0 3px rgba(52,211,153,0.08)", flexShrink: 0 },
  preview: { marginTop: 6, padding: "6px 10px", borderRadius: 6, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", fontSize: 11, color: "#7e7ea8", lineHeight: 1.5 },
  errorBox: { marginTop: 16, padding: "10px 14px", borderRadius: 8, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", fontSize: 12, color: "#f87171" },
  centered: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100%", padding: 40 },
  skeletonCard: { background: "#101427", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 14, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 9 },
  skel: { height: 9, borderRadius: 4, background: "linear-gradient(90deg, #090c1a 0%, rgba(255,255,255,0.07) 50%, #090c1a 100%)", backgroundSize: "200% 100%", animation: "shimmer 1.7s ease-in-out infinite" },
  reportHeader: { padding: "26px 36px 22px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "linear-gradient(180deg, rgba(124,109,255,0.04) 0%, transparent 80%)" },
  completeBadge: { fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", background: "rgba(52,211,153,0.18)", color: "#34d399", border: "1px solid rgba(52,211,153,0.28)", padding: "2px 9px", borderRadius: 99 },
  sectionTitle: { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "#7e7ea8", marginBottom: 14 },
  bodyText: { fontSize: 13, color: "#7e7ea8", lineHeight: 1.7, margin: 0 },
  insightRow: { display: "flex", alignItems: "flex-start", gap: 11, background: "#101427", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "12px 15px", marginBottom: 8 },
  insightDot: { width: 6, height: 6, background: "rgba(124,109,255,0.65)", borderRadius: "50%", flexShrink: 0, marginTop: 7 },
  compCard: { background: "#101427", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 14, padding: 14 },
  avatar: { width: 36, height: 36, borderRadius: 6, background: "rgba(124,109,255,0.1)", border: "1px solid rgba(124,109,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: "rgba(124,109,255,0.65)" },
  tag: { fontSize: 9.5, fontWeight: 600, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.05)", color: "#7e7ea8", padding: "2px 6px", borderRadius: 4 },
  recCard: { background: "#101427", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 14, padding: 16 },
  th: { textAlign: "left", padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.09)", color: "#7e7ea8", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" },
  td: { padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "#7e7ea8", fontSize: 12, lineHeight: 1.5 },
};
