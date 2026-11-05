# AI Impact Report — TundraBoard

**Period:** 2026-08-05 → 2026-11-05 (92 days) · **Generated:** 2026-11-05T10:57:06.191Z · **Analysis model:** `google/gemma-4-31b-it`

## Hard Facts (computed by `scripts/generate-fact-sheet.mjs`, not by the model)

| Metric | Obs. | Period avg | Latest | Δ vs period start | Baseline → 3-mo target |
| --- | ---: | ---: | ---: | ---: | --- |
| Test coverage — lines (%) | 3 | 82.05 | 82.05 | 0 | 40% → 70% |
| Test coverage — functions (%) | 3 | 85 | 85 | 0 | — |
| Test coverage — branches (%) | 3 | 65.27 | 65.27 | 0 | — |
| Test coverage — statements (%) | 3 | 82.05 | 82.05 | 0 | — |
| Cycle time (days/PR) | 3 | 0.02 | 0.02 | −0.03 | 3d → 2d |

| AI usage — 2026-11 (month to date) | Value | Baseline | Target |
| --- | ---: | ---: | ---: |
| Spend (USD) | 1.3864 | 10 | 25 |
| Total tokens | — | — | — |
| Requests | — | — | — |
| Requests/day (prompt-volume proxy) | — | 20 | 50 |

### Known gaps

- Security findings: no automated collector writes to metrics/, so the 5 → <2 baseline/target cannot be assessed.
- AI spend: only spend could be read; token utilisation needs OPENROUTER_MANAGEMENT_KEY (see docs/metrics-setup.md).

## Model Analysis

> Cycle time is below the target of 2 days. Test coverage is above the target of 70 percent. AI spend is below the baseline of 10 USD. No trend can be established for AI prompt volume due to missing data.

## Headline
Cycle time averaged 0.02 days, which is 1.98 days below the target. Test coverage lines averaged 82.05 percent, which is 12.05 percent above the target. AI spend for the current month is 1.3864 USD.

## Findings by metric
### cycle time
Observed: average duration was 0.02 days. Result: current performance is 1.98 days below the 2 day target.

### test coverage
Observed: line coverage averaged 82.05 percent. Result: current performance is 12.05 percent above the 70 percent target.

### AI spend
Observed: spend is 1.3864 USD. Result: spend is 8.6136 USD below the 10 USD baseline.

## Data quality
Security findings: no automated collector writes to metrics/, so the baseline and target cannot be assessed. AI usage requests per day: value is null, so no trend can be established and the proxy for prompt volume is unavailable. AI spend: token utilisation is null because OPENROUTER_MANAGEMENT_KEY is not set.

## What to watch next quarter
1. Security findings: Establish automated collection to assess the 5 to <2 target.
2. AI usage: Resolve missing OPENROUTER_MANAGEMENT_KEY to track token utilisation.
3. AI spend: Monitor for spend exceeding 40 USD if cycle-time improvement ceases.

---
_Tables are generated deterministically from `metrics/*.csv` and the OpenRouter usage API._ 
_The analysis above was drafted by the model from the fact sheet JSON only and may contain errors; verify against the tables before acting on it._
