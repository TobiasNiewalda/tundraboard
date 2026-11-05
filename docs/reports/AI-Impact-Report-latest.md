# AI Impact Report — TundraBoard

**Period:** 2026-08-05 → 2026-11-05 (92 days) · **Generated:** 2026-11-05T10:23:51.381Z · **Analysis model:** `google/gemma-4-31b-it`

## Hard Facts (computed by `scripts/generate-fact-sheet.mjs`, not by the model)

| Metric | Obs. | Period avg | Latest | Δ vs period start | Baseline → 3-mo target |
| --- | ---: | ---: | ---: | ---: | --- |
| Test coverage — lines (%) | 2 | 82.05 | 82.05 | 0 | 40% → 70% |
| Test coverage — functions (%) | 2 | 85 | 85 | 0 | — |
| Test coverage — branches (%) | 2 | 65.27 | 65.27 | 0 | — |
| Test coverage — statements (%) | 2 | 82.05 | 82.05 | 0 | — |
| Cycle time (days/PR) | 2 | 0.03 | 0 | −0.05 | 3d → 2d |

| AI usage — 2026-11 (month to date) | Value | Baseline | Target |
| --- | ---: | ---: | ---: |
| Spend (USD) | 1.2821 | 10 | 25 |
| Total tokens | — | — | — |
| Requests | — | — | — |
| Requests/day (prompt-volume proxy) | — | 20 | 50 |

### Known gaps

- Security findings: no automated collector writes to metrics/, so the 5 → <2 baseline/target cannot be assessed.
- Test coverage: only 2 observation(s) — not enough to establish a trend.
- Cycle time: only 2 merged PR(s) — not enough to establish a trend.
- AI spend: only spend could be read; token utilisation needs OPENROUTER_MANAGEMENT_KEY (see docs/metrics-setup.md).

## Model Analysis

> The quarterly report for TundraBoard shows insufficient data to establish trends for cycle time and test coverage. AI spend is below the baseline. No measurable AI impact on delivery speed or quality is observed.

## Headline
Cycle time and test coverage data are insufficient to establish trends. AI spend remains below the baseline.

## Findings by metric

### Cycle time
Observed: duration_days averaged 0.03 days over 2 observations. Result: The value is 2.97 days below the baseline of 3 days and 1.97 days below the target of 2 days.

### Test coverage
Observed: line coverage remained at 82.05 percent over 2 observations. Result: The value is 42.05 percent above the baseline of 40 percent and 12.05 percent above the target of 70 percent.

### AI spend
Observed: spend_usd is 1.2821. Result: The value is 8.7179 below the baseline of 10.

## Data quality
- Security findings: no automated collector writes to metrics/, so the 5  <2 baseline/target cannot be assessed.
- Test coverage: 2 observations are not enough to establish a trend.
- Cycle time: 2 merged PRs are not enough to establish a trend.
- AI spend: Token utilisation requires OPENROUTER_MANAGEMENT_KEY.
- Requests-per-day: No data available to use as a proxy for prompt volume.

## What to watch next quarter
- Security findings: establish automated collection to track the 5  <2 target.
- AI spend: monitor for spend > $40/month without cycle-time improvement.
- Prompt volume: monitor requests-per-day against the 20 baseline and 50 target.

---
_Tables are generated deterministically from `metrics/*.csv` and the OpenRouter usage API._ 
_The analysis above was drafted by the model from the fact sheet JSON only and may contain errors; verify against the tables before acting on it._
