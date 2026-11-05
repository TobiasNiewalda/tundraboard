# Analysis

Measured AI-impact data for TundraBoard (Chapter 5 — Measuring Impact). The
metric catalogue and dashboard design live in
`docs/course_materials/Chapter 5/Lesson 2/analysis.md`; this file holds the
data actually collected from the repo. Setup and permissions:
[docs/metrics-setup.md](docs/metrics-setup.md).

## Cycle Time

Collected automatically by `.github/workflows/metrics-cycle-time.yml`: every
merged PR appends one row (PR number, merge date, decimal days from the PR's
first commit to its merge) to [`metrics/cycle_time.csv`](metrics/cycle_time.csv).
Trend it against the 3-day baseline in the lesson analysis.

## AI Tool Spend/Usage

Refresh this section with the OpenRouter usage script, then paste/append its
Markdown output below the marker (or redirect it straight into this file):

```sh
npm run ai:usage                          # prints the snippet to stdout
node scripts/fetch_ai_usage.js >> analysis.md
```

<!-- AI USAGE SNIPPET: append generated output below this line; replace any
     older block to keep history lean. Requires OPENROUTER_API_KEY - see
     docs/metrics-setup.md. -->
