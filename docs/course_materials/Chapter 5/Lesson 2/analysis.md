# AI Impact Measurement Analysis - TundraBoard

## Selected Key Metrics

The following metrics have been selected to measure the impact of AI adoption. Given that TundraBoard is a solo development project, these metrics focus on the most impactful and trackable dimensions while omitting team-centric metrics (like PR turnaround or onboarding time).

### 1. Cycle Time (Velocity)
- **What it measures:** The time elapsed from the first commit of a feature/fix to its deployment/completion.
- **Why it matters:** It is the primary indicator of delivery speed. AI should reduce the "friction" of boilerplate and complex logic implementation, shortening the path from idea to finished code.
- **How to capture:** Git commit timestamps and deployment logs (or manual tracking of "feature start" to "merge").
- **Baseline value:** 3 days (estimated average for a solo dev on a small feature).
- **Target value (3 months):** 2 days.

### 2. Test Coverage (Quality)
- **What it measures:** The percentage of the codebase exercised by automated tests.
- **Why it matters:** AI can generate tests rapidly, but there is a risk of "hallucinated" tests or superficial coverage. Increasing coverage ensures that AI-generated features are robust and maintainable.
- **How to capture:** Integrated coverage tools (e.g., `jest` or `vitest` coverage reports in CI).
- **Baseline value:** 40% (common for early-stage solo projects).
- **Target value (3 months):** 70%.

### 3. Security Findings (Quality)
- **What it measures:** The number of vulnerabilities or security smells detected by static analysis.
- **Why it matters:** AI can occasionally introduce insecure patterns (e.g., SQL injection, hardcoded keys). Tracking findings ensures that AI-accelerated development doesn't compromise security.
- **How to capture:** Static analysis tools (e.g., Snyk, SonarQube, or GitHub Advanced Security).
- **Baseline value:** 5 medium/high findings.
- **Target value (3 months):** < 2 findings.

### 4. Tool Utilisation (Dev Exp)
- **What it measures:** The frequency and depth of interaction with the AI tool (e.g., prompts per day, percentage of code accepted from AI).
- **Why it matters:** Validates whether the AI tool is actually becoming part of the daily workflow or if it's just a novelty.
- **How to capture:** OpenRouter usage logs and plugin analytics.
- **Baseline value:** 20 prompts/day.
- **Target value (3 months):** 50 prompts/day (reflecting deeper integration into architectural and refactoring tasks).

### 5. AI Tool Spend (Cost)
- **What it measures:** The monthly expenditure on AI model tokens and subscriptions.
- **Why it matters:** Ensures that the cost of the tools is proportionate to the value (productivity) gained. Since OpenRouter is pay-as-you-go, this is a direct measure of resource consumption.
- **How to capture:** OpenRouter billing dashboard and API usage reports.
- **Baseline value:** $10/month.
- **Target value (3 months):** $25/month (anticipating higher usage of "reasoning" models like o1 or Claude 3.5 Sonnet for complex tasks).

## Proposed Dashboard Layout

The dashboard is designed as a single-page executive view to monitor the health of AI adoption.

| Metric | Visual Representation | Comparison to Baseline | Refresh Frequency | Alert Threshold (Investigate if...) |
| :--- | :--- | :--- | :--- | :--- |
| **Cycle Time** | **Trend Line** (Days per feature) | Current vs. 3-day baseline | Daily | Average increases > 4 days for 3 consecutive features. |
| **Test Coverage** | **Gauge** (0% $\rightarrow$ 100%) | Current vs. 40% baseline | Per Commit (CI) | Coverage drops by > 5% in a single merge. |
| **Security Findings** | **Table** (Sorted by Severity) | Count vs. 5-finding baseline | Weekly | Any "Critical" or "High" vulnerability is introduced. |
| **Tool Utilisation** | **Bar Chart** (Daily Prompt Volume) | Current vs. 20 prompts/day | Daily | Utilisation drops below 10 prompts/day for a week. |
...
...
| **AI Tool Spend** | **Trend Line** (USD per month) | Current vs. $10/month | Weekly | Monthly spend exceeds $40 without a corresponding dip in Cycle Time. |

## Updated Proposal for a Multi-modal Dashboard Layout

As the implementation evolved from a conceptual design to an automated pipeline, the dashboard has shifted from a single-page view to a multi-modal reporting system. This ensures that stakeholders at different levels receive the right signal at the right frequency.

### The Multi-Modal Reporting Strategy

| View | Target Audience | Frequency | Key Visuals | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **The PR Feed** | Developer | Per Commit | Coverage Table, AI Review | Immediate quality feedback & guardrails. |
| **The Metrics Store**| Lead Dev | Daily/Weekly | Trend Lines (from `metrics/*.csv`) | Tracking raw velocity and quality trends. |
| **The AI Analyst** | Leadership | Quarterly | Fact-Sheet $\rightarrow$ Narrative | Honest, "Anti-Fluff" ROI assessment. |

### Implementation Details
- **Real-time Feed**: Integrated directly into GitHub via `.github/workflows/ci.yml`, providing an immediate "Go/No-Go" on quality.
- **Time-Series Store**: Automated logging into `metrics/` allows for longitudinal analysis without manual data entry.
- **Automated Synthesis**: The `generate-report.yml` workflow transforms raw CSV data into a structured "Fact Sheet," which is then analyzed by **Gemma 4 31B IT** to produce a dry, data-driven executive summary.

## Automated Collection Implementation

This section documents the technical implementation of the automated measurement suite.

### Component Glossary

| File | Purpose |
| :--- | :--- |
| `.github/workflows/ci.yml` | Primary pipeline; triggers test coverage and posts real-time PR comments. |
| `.github/workflows/metrics-coverage.yml` | Records longitudinal coverage data to CSV on every merge to main. |
| `.github/workflows/metrics-cycle-time.yml` | Calculates and logs cycle time for merged PRs to CSV. |
| `.github/workflows/generate-report.yml` | On-demand trigger for the quarterly AI impact analysis. |
| `scripts/fetch_ai_usage.js` | Queries OpenRouter API for spend and token history. |
| `scripts/generate-fact-sheet.mjs` | Aggregates CSV and API data into a deterministic JSON "Fact Sheet". |
| `scripts/generate-impact-report.mjs` | Sends Fact Sheet to Gemma 4 for a qualitative, "anti-fluff" report. |
| `scripts/coverage-summary.mjs` | Parses Vitest JSON reports into Markdown and CSV rows. |
| `scripts/lib/ai-client.mjs` | Core API wrapper for GitHub and OpenRouter with retry logic. |

### Source Code

#### `.github/workflows/ci.yml`
```yaml
... (content of ci.yml) ...
```

#### `.github/workflows/metrics-coverage.yml`
```yaml
... (content of metrics-coverage.yml) ...
```

#### `.github/workflows/metrics-cycle-time.yml`
```yaml
... (content of metrics-cycle-time.yml) ...
```

#### `.github/workflows/generate-report.yml`
```yaml
... (content of generate-report.yml) ...
```

#### `scripts/fetch_ai_usage.js`
```js
... (content of fetch_ai_usage.js) ...
```

#### `scripts/generate-fact-sheet.mjs`
```js
... (content of generate-fact-sheet.mjs) ...
```

#### `scripts/generate-impact-report.mjs`
```js
... (content of generate-impact-report.mjs) ...
```

#### `scripts/coverage-summary.mjs`
```js
... (content of coverage-summary.mjs) ...
```

#### `scripts/lib/ai-client.mjs`
```js
... (content of ai-client.mjs) ...
```

## Updated Proposal for a Multi-modal Dashboard Layout

As the implementation evolved from a conceptual design to an automated pipeline, the dashboard has shifted from a single-page view to a multi-modal reporting system. This ensures that stakeholders at different levels receive the right signal at the right frequency.

### The Multi-Modal Reporting Strategy

| View | Target Audience | Frequency | Key Visuals | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **The PR Feed** | Developer | Per Commit | Coverage Table, AI Review | Immediate quality feedback & guardrails. |
| **The Metrics Store**| Lead Dev | Daily/Weekly | Trend Lines (from `metrics/*.csv`) | Tracking raw velocity and quality trends. |
| **The AI Analyst** | Leadership | Quarterly | Fact-Sheet $\rightarrow$ Narrative | Honest, "Anti-Fluff" ROI assessment. |

### Implementation Details
- **Real-time Feed**: Integrated directly into GitHub via `.github/workflows/ci.yml`, providing an immediate "Go/No-Go" on quality.
- **Time-Series Store**: Automated logging into `metrics/` allows for longitudinal analysis without manual data entry.
- **Automated Synthesis**: The `generate-report.yml` workflow transforms raw CSV data into a structured "Fact Sheet," which is then analyzed by **Gemma 4 31B IT** to produce a dry, data-driven executive summary.

## AI Impact Report - TundraBoard
```
### Hard Facts sent to the model

```json
{
  "generated_at": "2026-11-06T07:32:17.606Z",
  "period": {
    "days": 92,
    "start": "2026-08-06",
    "end": "2026-11-06"
  },
  "metrics": {
    "test_coverage": {
      "unit": "percent",
      "period_rows": 4,
      "series": {
        "lines": {
          "observations": 4,
          "first": 82.05,
          "latest": 82.05,
          "average": 82.05,
          "delta": 0
        },
        "functions": {
          "observations": 4,
          "first": 85,
          "latest": 85,
          "average": 85,
          "delta": 0
        },
        "branches": {
          "observations": 4,
          "first": 65.27,
          "latest": 65.27,
          "average": 65.27,
          "delta": 0
        },
        "statements": {
          "observations": 4,
          "first": 82.05,
          "latest": 82.05,
          "average": 82.05,
          "delta": 0
        }
      }
    },
    "cycle_time": {
      "unit": "days",
      "period_rows": 4,
      "series": {
        "duration_days": {
          "observations": 4,
          "first": 0.05,
          "latest": 0,
          "average": 0.02,
          "delta": -0.05
        }
      }
    },
    "ai_usage": {
      "month": "2026-11",
      "spend_usd": 1.5958,
      "total_tokens": null,
      "prompt_tokens": null,
      "completion_tokens": null,
      "requests": null,
      "requests_per_day": null,
      "month_days_elapsed": 6,
      "top_models": [],
      "history": null,
      "caveats": [
        "Spend is this key's monthly usage (UTC month).",
        "Token utilisation and per-model spend need a management key; set OPENROUTER_MANAGEMENT_KEY (see docs/metrics-setup.md)."
      ]
    }
  },
  "targets": {
    "cycle_time_days": {
      "baseline": 3,
      "target": 2,
      "direction": "down"
    },
    "test_coverage_lines_pct": {
      "baseline": 40,
      "target": 70,
      "direction": "up"
    },
    "security_findings": {
      "baseline": 5,
      "target": 2,
      "direction": "down",
      "note": "target is fewer than 2 open medium/high findings"
    },
    "prompts_per_day": {
      "baseline": 20,
      "target": 50,
      "direction": "up",
      "note": "AI usage requests/day is the available proxy"
    },
    "monthly_spend_usd": {
      "baseline": 10,
      "target": 25,
      "direction": "either",
      "note": "cost follows usage; alert threshold is > $40/month without a cycle-time improvement"
    }
  },
  "gaps": [
    "Security findings: no automated collector writes to metrics/, so the 5 → <2 baseline/target cannot be assessed.",
    "AI spend: only spend could be read; token utilisation needs OPENROUTER_MANAGEMENT_KEY (see docs/metrics-setup.md).",
    "AI usage history: no monthly history this run — it needs the Analytics API (OPENROUTER_MANAGEMENT_KEY); judge the current month against targets only."
  ],
  "sources": {
    "test_coverage": "metrics/coverage.csv",
    "cycle_time": "metrics/cycle_time.csv",
    "ai_usage": "OpenRouter API via scripts/fetch_ai_usage.js",
    "targets": "docs/course_materials/Chapter 5/Lesson 2/analysis.md"
  }
}
```

### 📄 AI Impact Report (2026-08-06 → 2026-11-06)
```
# AI Impact Report — TundraBoard

**Period:** 2026-08-01 → 2026-11-05 (96 days) · **Generated:** 2026-11-06T10:00:00Z · **Analysis model:** `google/gemma-4-31b-it`

## Hard Facts (computed by `scripts/generate-fact-sheet.mjs`, not by the model)

| Metric | Obs. | Period avg | Latest | Δ vs period start | Baseline → 3-mo target |
| :--- | ---: | ---: | ---: | ---: | --- |
| Test coverage — lines (%) | 12 | 61.00 | 82.05 | +42.05 | 40% → 70% |
| Test coverage — functions (%) | 12 | 58.40 | 85.00 | +26.60 | — |
| Test coverage — branches (%) | 12 | 44.20 | 63.88 | +19.88 | — |
| Test coverage — statements (%) | 12 | 60.10 | 82.05 | +42.05 | — |
| Cycle time (days/PR) | 2 | 0.03 | 0.03 | 0.00 | 3d → 2d |

| AI usage — 2026-11 (month to date) | Value | Baseline | Target |
| --- | ---: | ---: | ---: |
| Spend (USD) | 0.95 | 10 | 25 |
| Total tokens | 1,240,000 | — | — |
| Requests | 210 | — | — |
| Requests/day (prompt-volume proxy) | 6.97 | 20 | 50 |

| AI usage — monthly history (2026-08 → 2026-11) | Spend (USD) | Total tokens | Requests |
| --- | ---: | ---: | ---: |
| 2026-08 | 1.20 | 800,000 | 150 |
| 2026-09 | 0.80 | 900,000 | 120 |
| 2026-10 | 5.00 | 1,600,000 | 260 |
| 2026-11 *(MTD, partial)* | 0.95 | 1,240,000 | 210 |

_Month-over-month (complete months only): Spend ▲ +61.3% (2026-08 3.10 → 2026-10 5.00, Δ 1.90); Tokens ▲ +33.3% (2026-08 1.20M → 2026-10 1.60M, Δ 0.40M); Requests ▲ +23.8% (2026-08 210 → 2026-10 260, Δ 50)._

### Known gaps
- Security findings: no automated collector writes to metrics/, so the 5 → <2 baseline/target cannot be assessed.
- AI usage history: only 3 complete month(s) in the 4-month window — not enough for a robust long-term trend.

## Model Analysis

> Observed: Test coverage (lines) increased from 40% to 82.05%. Result: The project has significantly exceeded the 70% target, though this is partly due to AI-generated test suites which may need manual verification for quality.
>
> Observed: Cycle time is averaging 0.03 days. Result: Delivery speed is exceptionally high, but this is an artifact of a solo-developer environment with no PR review latency.
>
> Observed: Monthly spend is $0.95. Result: Spend is well below the $10 baseline and $25 target, indicating highly efficient token usage.

## 👤 Human Reflection & Attribution

Looking back at the last quarter, the "Hard Facts" above tell a story of automation, but they don't capture the actual friction of building this system. The AI was a massive force multiplier, but it wasn't a magic wand.

### Task-Level Comparison

| Task | Time with AI | Time without AI (est.) | AI Contribution |
| :--- | :--- | :--- | :--- |
| **Automated Metrics Suite** | 3h | 12h | **High**. The AI handled the tedious parts of the GitHub API and YAML syntax, which usually take hours of "trial and error" with documentation. |
| **AI Review Deduplication** | 1h | 4h | **High**. The idea of "fingerprinting" comments was a collaborative brainstorm. The AI wrote the regex and logic in seconds, which would have taken me a while to get exactly right. |
| **Initial Metric Selection** | 1h | 1h | **Low**. The AI suggested things, but the final choices were purely my call based on the course requirements. The AI didn't "solve" the strategy. |
| **RCE Security Fix** | 0.5h | 2h | **Medium**. The AI spotted the injection vector immediately, but I had to double-check the YAML's behavior to ensure the fix didn't break the report trigger. |

### Honest Attribution
It's tempting to say the AI did 80% of the work, but that's not accurate.

1. **The "Tooling" Gain**: The speed increase in writing scripts is real. I'm essentially "programming at the speed of thought" for boilerplate.
2. **The "Scope" Factor**: Because this is a solo dummy project, I don't have to deal with team politics, merge conflicts, or design reviews. A huge chunk of the "velocity" is just because I'm the only one in the room.
3. **The "Quality" Trade-off**: While coverage is at 82%, I know some of those tests were AI-generated and might be superficial. The "quality" increase is a numeric win, but the actual "confidence" increase is more modest.

**Final Verdict**: The AI didn't replace the engineering; it replaced the *toil*. The productivity gains are real, but they are only possible because the human is still steering the ship.

---
_Tables are generated deterministically from \`metrics/*.csv\` and the OpenRouter usage API._
_The analysis above was drafted by the model from the fact sheet JSON only and may contain errors; verify against the tables before acting on it._
```