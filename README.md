# Competitive Intelligence Agent

An AI-powered agent that automates competitive landscape research. Enter a company name, and the agent runs a 5-step research pipeline — from problem framing through strategic synthesis — generating a structured competitive analysis report in ~60 seconds.

Built as a weekend prototype to explore how agentic AI can augment product and market research workflows.

![Agent Demo](https://img.shields.io/badge/status-prototype-blue) ![Built With](https://img.shields.io/badge/built%20with-Claude%20API-orange)

---

## What It Does

The agent takes a company name (e.g., "WHOOP") and optional context (e.g., "consumer wearables, fitness-focused") and executes a 5-step research pipeline:

| Step | What Happens | Tools Used |
|------|-------------|------------|
| **1. Problem Framing** | Identifies the product category, target market, and key comparison dimensions | Claude API |
| **2. Competitor Discovery** | Searches the web to find 4-6 direct and adjacent competitors | Claude API + Web Search |
| **3. Data Collection** | Gathers positioning, pricing, features, and recent moves for each competitor | Claude API + Web Search |
| **4. Comparative Analysis** | Compares competitors across dimensions, identifies gaps and clusters | Claude API |
| **5. Synthesis** | Generates an executive report with insights, recommendations, and risk factors | Claude API |

Each step's output feeds into the next, creating a chain of progressively richer analysis. The user sees each step's progress in real time.

## What Makes It "Agentic"

This isn't a single-prompt wrapper. The agent:

- **Makes decisions** — it chooses which competitors matter and which dimensions to compare (not hardcoded)
- **Uses tools** — steps 2 and 3 use web search to pull live, current data
- **Chains reasoning** — each step builds on all prior outputs, accumulating context
- **Shows its work** — the step tracker displays what the agent is doing and what it found at each stage

## Output

The final report includes:

- **Executive Summary** — landscape overview with category and market framing
- **Competitor Profiles** — positioning, pricing, features, strengths/weaknesses for each competitor
- **Competitive Comparison Matrix** — side-by-side assessment across key dimensions
- **Market Gaps & Whitespace** — opportunities the agent identified
- **Strategic Recommendations** — actionable next steps with rationale
- **Risk Factors & Outlook** — threats and forward-looking perspective

## Project Structure

```
├── src/
│   ├── App.jsx          # Main app component (Vite version)
│   ├── index.css        # Styles
│   └── main.jsx         # Entry point
├── artifact/
│   └── landscape-agent.jsx  # Self-contained Claude.ai artifact version
├── demo.html            # Standalone HTML demo
├── index.html           # Vite HTML shell
├── package.json
├── vite.config.js
└── README.md
```

### Two Versions

**1. Vite App (`/src`)** — Full React project. Requires an Anthropic API key to run standalone. Best for local development and deployment.

**2. Claude.ai Artifact (`/artifact`)** — Single-file React component that runs inside Claude.ai using the built-in API access. No API key needed (uses your Claude Pro subscription).

## Running Locally (Vite Version)

```bash
# Clone the repo
git clone https://github.com/AdokshSuryawanshi/competitive-intelligence-agent.git
cd competitive-intelligence-agent

# Install dependencies
npm install

# Start dev server
npm run dev
```

> **Note:** The Vite version requires an Anthropic API key to make live API calls. The current codebase uses mock data for the UI demo. To connect live API calls, you'd add the prompt chain from the artifact version and configure API authentication.

## Running in Claude.ai (Artifact Version)

1. Open Claude.ai (requires Claude Pro)
2. Copy the contents of `artifact/landscape-agent.jsx`
3. Ask Claude to create an artifact with this code
4. Use the agent directly — no setup needed

## Tech Stack

- **React 18** — UI framework
- **Vite** — Build tool
- **Claude API (Sonnet)** — LLM backbone for all 5 research steps
- **Web Search Tool** — Live data retrieval for competitor discovery and data collection

## Design Decisions

**Why 5 separate API calls instead of 1?**
A single prompt produces generic, hallucinated output. Breaking the research into steps lets each call focus on one task, use web search when needed, and pass verified data forward. The tradeoff is latency (~60s total), but the output quality is significantly higher.

**Why show the agent's progress?**
Transparency in AI systems builds trust. Showing each step's output lets users verify the agent's reasoning and catch errors early — a core UX principle for AI products.

**Why JSON-only responses?**
Structured output makes the data programmatically usable. The agent returns JSON at every step, which feeds cleanly into the next step and renders directly in the UI without parsing markdown.

## Limitations

- **Breadth over depth** — the agent surfaces ~70% of what a thorough manual analysis would find. It misses paywalled data, niche competitors with low web presence, and proprietary metrics.
- **Web search dependent** — output quality is bounded by what search returns. Recent or obscure companies may have sparse results.
- **No persistence** — each run is independent. There's no way to save, compare, or iterate on reports (yet).

## What I'd Build Next

- **Export to PDF/slides** — one-click report export for stakeholder sharing
- **Comparison mode** — run multiple analyses and compare landscapes side by side
- **Source citations** — link each data point back to the web source it came from
- **Custom dimensions** — let users define their own comparison axes before running
- **Historical tracking** — re-run analyses over time to track competitive shifts

---

*Built by Adoksh as a portfolio project exploring agentic AI for product research.*
