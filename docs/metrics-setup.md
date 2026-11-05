# Metrics Data Collection — Setup Guide

Automated collection of three AI-impact metrics (Chapter 5, Lesson 2):

| Metric                            | Collector                                  | Output                             |
| --------------------------------- | ------------------------------------------ | ---------------------------------- |
| Cycle time (first commit → merge) | `.github/workflows/metrics-cycle-time.yml` | `metrics/cycle_time.csv`           |
| Test coverage                     | `.github/workflows/metrics-coverage.yml`   | `metrics/coverage.csv`             |
| AI tool spend / token utilisation | `scripts/fetch_ai_usage.js`                | Markdown snippet for `analysis.md` |
| AI Impact Report (quarterly)      | `.github/workflows/generate-report.yml`    | `docs/reports/AI-Impact-Report-latest.md` |

## 1. Environment variables

Used by the local script (`npm run ai:usage`). The repo's `.env` file is loaded
automatically (dotenv is already a dependency); see `.env.example`.

| Variable                    | Required | Purpose                                                                                                                                                                                                                                              |
| --------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OPENROUTER_API_KEY`        | **Yes**  | Any OpenRouter API key ([openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)). `GET /api/v1/key` returns the key's monthly spend — this alone produces a valid snippet.                                                                |
| `OPENROUTER_MANAGEMENT_KEY` | Optional | Unlocks the **Analytics API** (token utilisation, per-model breakdown) and the account credit balance. Create it under **Settings → API Keys → Manage → New Management Key**. Without it the snippet still renders and says which parts are missing. |
| `OPENROUTER_BASE_URL`       | Optional | Override the API endpoint (tests / proxying). Defaults to `https://openrouter.ai/api/v1`.                                                                                                                                                            |

Run it (PowerShell):

```powershell
$env:OPENROUTER_API_KEY = "sk-or-v1-..."        # or put it in .env
node scripts/fetch_ai_usage.js                  # prints the Markdown snippet
node scripts/fetch_ai_usage.js >> analysis.md  # append under the Spend/Usage section
```

Exit codes: `0` success, `2` missing configuration, `1` API failure.

## 2. GitHub Secrets

The cycle-time workflow needs **no secrets** — it uses the built-in
`GITHUB_TOKEN` with permissions declared in the workflow itself:

```yaml
permissions:
  contents: write # append metrics/cycle_time.csv and push to main
  pull-requests: read # read the PR's commit list via `gh api`
```

The coverage workflow likewise needs **no secrets** (`contents: write` to
append `metrics/coverage.csv`); the coverage **PR comment** is posted by the
CI workflow's `test` job, which adds `pull-requests: write`:

```yaml
permissions:
  contents: read
  pull-requests: write # upsert the coverage comment on PR runs
```

An explicit `permissions` block overrides the repo default ("Read
repository contents only"), so the workflow stays authorised even if
**Settings → Actions → General → Workflow permissions** is read-only.

| Secret                                   | Needed when                                                                     | Notes                                                                                                                                                        |
| ---------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GITHUB_TOKEN`                           | always (automatic)                                                              | Provided by Actions; never create it manually.                                                                                                               |
| `AI_API_KEY`                             | AI Impact Report + PR review workflows                                          | The OpenRouter key used for the model call. Falls back to `OPENROUTER_API_KEY` in the report workflow, so one of the two must exist.                          |
| `OPENROUTER_API_KEY`                     | AI Impact Report (spend row + fallback model key)                               | **Settings → Secrets and variables → Actions → New repository secret.** Without it the fact sheet records a gap instead of failing.                           |
| `OPENROUTER_MANAGEMENT_KEY`              | only for token utilisation in the report                                        | Same place as above; unlocks the Analytics API (tokens, per-model spend).                                                                                     |
| `AI_BASE_URL` / `AI_MODEL` (variables)   | optional                                                                        | Already used by PR review (see `docs/ai-review-setup.md`). The report overrides the model itself; see section 7.                                              |

## 3. Repository settings checklist (one-time)

1. **Branch protection on `main`** — the workflow appends directly to `main`.
   If "Require a pull request before merging" is enabled, add **`github-actions`
   / the repository's Actions bypass** to the bypass list
   (Settings → Branches → your rule → "Allow specified actors to bypass
   required pull requests"), otherwise the push step fails.
   (The metrics commits carry `[skip ci]`, so they don't burn CI runs.)
2. **Merge method** — cycle time uses the PR's commit list from the GitHub
   API, which is present for squash, rebase and merge-commit workflows alike.
3. Nothing else: both metrics workflows create their CSV if it is missing and
   skip commits/PRs that are already recorded (safe re-runs).

## 4. Verify it works

```sh
# Script: prints a Markdown table or a clear config error
npm run ai:usage

# Workflow: merge any PR, then check
git pull && tail metrics/cycle_time.csv
# -> pr_number,date,duration_days
# -> 15,2026-11-05,0.42

# Coverage: locally, any time
npm run test:coverage
node scripts/coverage-summary.mjs markdown
# After a merge to main:
git pull && tail metrics/coverage.csv
# -> 2026-11-05,3f2a1bc...,82.05,85.00,63.88,82.05
```

The run's step summary shows the measured value, and the repo's
**Actions → Cycle Time Metrics** / **Actions → Coverage Metrics** pages keep
the history of recordings.

## 5. CSV format

`metrics/cycle_time.csv` — append-only, newest at the bottom:

```csv
pr_number,date,duration_days
15,2026-11-05,0.42
```

- `pr_number` — merged pull request number (unique key).
- `date` — merge date, `YYYY-MM-DD` UTC.
- `duration_days` — first commit → merge, in decimal days (`(merged_at −
first_commit_author_date) / 86400`, clamped at 0). Author dates are used so a
  rebase right before merging does not erase the real work window.

`metrics/coverage.csv` — append-only, one row per commit landing on `main`
(merges _and_ direct pushes), newest at the bottom:

```csv
date,commit,lines,functions,branches,statements
2026-11-05,3f2a1bc8945d...,82.05,85.00,63.88,82.05
```

- `date` — UTC date the row was recorded, `YYYY-MM-DD`.
- `commit` — full SHA of the measured commit (unique key; re-runs are skipped).
- `lines` / `functions` / `branches` / `statements` — Vitest `v8` coverage
  totals in percent (from `coverage/coverage-summary.json`), 2 decimals.

## 6. Test coverage: reading the results

Coverage reaches you in three places, all produced by the same data:

| Where                                                       | When                        | What you see                                    |
| ----------------------------------------------------------- | --------------------------- | ----------------------------------------------- |
| CI job summary (**Actions → CI → test → Summary**)          | every PR and push to `main` | Markdown table of the four totals               |
| PR comment (head comment, upserted)                         | every push to a PR          | Same table, headline `Overall coverage (lines)` |
| `metrics/coverage.csv` (via **Actions → Coverage Metrics**) | every merge/push to `main`  | One history row per commit                      |

Interpreting against the metric definition
(`docs/course_materials/Chapter 5/Lesson 2/analysis.md`):

- **Headline number = the `lines` percentage** (the dashboard gauge). The PR
  run measures the PR _merge_ result, so comment and CSV agree with what
  actually landed.
- **Baseline 40%, target 70%** — each report prints the delta vs the 40%
  baseline. Current totals (`lines`/`statements` ≈ 82%, `functions` 85%) are
  above the 3-month target; the trend is what matters, not a single number.
- **Alert: a drop of more than 5 pp in a single merge.** The Coverage Metrics
  workflow compares the new `lines` value against the previous CSV row and
  raises a `::warning::` annotation (plus a line in the run summary) — that is
  the "investigate" trigger from analysis.md. Not an error: recording proceeds
  so the dip stays visible in the trend.
- **Hard floors are separate**: `vitest.config.ts` thresholds (lines 80,
  branches 45, functions 80) make `npm run test:coverage` — and thus CI —
  _fail_ below them. The CSV alert is softer: it flags regressions that stay
  above the thresholds.
- **Branches lags intentionally.** The v8 branch metric counts unreachable
  defensive branches (e.g. error paths of a small Express app); watch it for
  direction, don't chase it per-file.

No new dependencies: the reporting reuses `@vitest/coverage-v8` (already
installed) plus the `json-summary` reporter it emits. The helper
`coverage-summary.mjs` under `scripts/` is plain Node, matching the other
`scripts/*.mjs`. To reproduce the pipeline locally:

```sh
npm run test:coverage                      # writes coverage/coverage-summary.json
node scripts/coverage-summary.mjs markdown # the same table CI posts
node scripts/coverage-summary.mjs pct      # just the headline lines %
```

## 7. AI Impact Report (quarterly, on-demand)

One `workflow_dispatch` run produces the whole report in three stages:

1. **Fact sheet** — `scripts/generate-fact-sheet.mjs` reads
   `metrics/coverage.csv` and `metrics/cycle_time.csv`, computes
   average / latest / Δ-vs-period-start (92-day window) per series, pulls the
   current month's spend and token usage through `collectFacts()` from
   `scripts/fetch_ai_usage.js`, and embeds the baseline/3-month targets from
   `docs/course_materials/Chapter 5/Lesson 2/analysis.md`. Missing sources
   become explicit `gaps` entries — the pipeline never blocks on absent data.
2. **Model analysis** — `scripts/generate-impact-report.mjs` sends that JSON to
   OpenRouter via the shared `scripts/lib/ai-client.mjs`, under an "Anti-Fluff"
   system prompt: dry data-analyst persona, every claim in
   `Observed → Result` form, banned marketing vocabulary (leverage,
   game-changer, …), and an instruction to report flat or missing data as
   exactly that. Only numbers from the fact sheet may appear.
3. **Report** — the numeric tables are rendered by the script (not the model),
   combined with the analysis, and committed to
   `docs/reports/AI-Impact-Report-latest.md` on `main` with `[skip ci]`.

### Trigger it

**Actions → AI Impact Report → Run workflow** (branch: `main`). The optional
`model` input overrides the analysis model for one run. No schedule is set on
purpose — quarterly means someone decides when the quarter is worth reporting.

### Configuration

- **Required:** `AI_API_KEY` **or** `OPENROUTER_API_KEY` as a repository secret
  (the workflow maps either one to both roles: model call + spend lookup).
  A run without either fails at the model step (exit 2) instead of committing
  a stub report.
- **Model default:** `google/gemma-4-31b-it`, used unless
  `vars.AI_IMPACT_MODEL`, `vars.AI_MODEL` or the `model` input is set. Use the
  **plain OpenRouter id** (`owner/model`, optionally `:free`) — the API rejects
  the harness-style `openrouter/…` prefix with a 400.
- **Optional:** `OPENROUTER_MANAGEMENT_KEY` for tokens/requests per model;
  without it the usage table shows spend only and says so under "Known gaps".
- **Branch protection:** same Actions bypass as the metrics workflows
  (checklist item 1) — the report step pushes directly to `main`.
- The report workflow needs **no `npm ci`**: both scripts are plain Node and
  talk to the APIs with global `fetch`.

### Run it locally

```powershell
npm run report:facts -- fact-sheet.json   # writes the JSON (no key needed)
$env:AI_API_KEY = "sk-or-v1-..."          # or reuse OPENROUTER_API_KEY
$env:AI_BASE_URL = "https://openrouter.ai/api/v1"
node scripts/generate-impact-report.mjs fact-sheet.json
# -> docs/reports/AI-Impact-Report-latest.md
```

`fact-sheet.json` is git-ignored; only the rendered report is committed.

### Failure behaviour

| Condition                          | What happens                                                              |
| ---------------------------------- | ------------------------------------------------------------------------- |
| CSV missing / thin / no key for usage | Reported as `gaps` in the fact sheet and in the report's "Known gaps". |
| Model outage / rate limit          | Facts-only report is committed with a `::warning::` — no prose is invented. |
| Missing/invalid AI key             | Run fails (exit 2); nothing is committed.                                 |
| Model sneaks in a banned buzzword  | Kept verbatim for transparency + `::warning::` listing the words.         |

## Troubleshooting

- **401/403 from the script** → key typo'd/expired, or `OPENROUTER_MANAGEMENT_KEY`
  missing when Analytics data is wanted (the snippet degrades instead of failing).
- **Push rejected in a workflow** → branch protection without an Actions bypass
  (see checklist item 1).
- **`0.00 days` for a squash-merged PR** → all work was committed and merged in
  under a minute; check the step summary for the recorded timestamps.
- **`coverage-summary: could not read coverage/coverage-summary.json`** →
  coverage wasn't generated; run `npm run test:coverage` (the `json-summary`
  reporter must stay in `vitest.config.ts`), or keep `--coverage` when calling
  vitest directly.
- **Coverage CI step fails but tests pass** → a `vitest.config.ts` threshold
  was breached (exit code lists which metric); the run records nothing to the
  CSV, so main keeps its last good row.
- **CI comment not appearing** → the `test` job's `pull-requests: write`
  permission, or Settings → Actions → General → Workflow permissions being
  stricter than a per-job `permissions` block allows; the job summary still
  shows the table either way.
