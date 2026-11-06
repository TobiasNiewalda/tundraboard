# AI Impact Report — TundraBoard

**Period:** 2026-08-06 → 2026-11-06 (92 days) · **Generated:** 2026-11-06T07:32:17.606Z · **Analysis model:** `google/gemma-4-31b-it`

## Hard Facts (computed by `scripts/generate-fact-sheet.mjs`, not by the model)

| Metric | Obs. | Period avg | Latest | Δ vs period start | Baseline → 3-mo target |
| --- | ---: | ---: | ---: | ---: | --- |
| Test coverage — lines (%) | 4 | 82.05 | 82.05 | 0 | 40% → 70% |
| Test coverage — functions (%) | 4 | 85 | 85 | 0 | — |
| Test coverage — branches (%) | 4 | 65.27 | 65.27 | 0 | — |
| Test coverage — statements (%) | 4 | 82.05 | 82.05 | 0 | — |
| Cycle time (days/PR) | 4 | 0.02 | 0 | −0.05 | 3d → 2d |

| AI usage — 2026-11 (month to date) | Value | Baseline | Target |
| --- | ---: | ---: | ---: |
| Spend (USD) | 1.5958 | 10 | 25 |
| Total tokens | — | — | — |
| Requests | — | — | — |
| Requests/day (prompt-volume proxy) | — | 20 | 50 |

_Monthly usage history: not available this run — it needs an OpenRouter management key. The snapshot above is judged on its own; see Known gaps._

### Known gaps

- Security findings: no automated collector writes to metrics/, so the 5 → <2 baseline/target cannot be assessed.
- AI spend: only spend could be read; token utilisation needs OPENROUTER_MANAGEMENT_KEY (see docs/metrics-setup.md).
- AI usage history: no monthly history this run — it needs the Analytics API (OPENROUTER_MANAGEMENT_KEY); judge the current month against targets only.

## Model Analysis

> Cycle time and test coverage remained stable or below targets. AI spend for the current partial month is $1.5958. No multi-month trends are available due to missing API data.

## Headline
Cycle time averaged 0.02 days, which is 2.98 days below the target of 2 days. Test coverage for lines averaged 82.05%, which is 12.05% above the target of 70%. 

## Findings by metric
### cycle time
Observed: average duration_days was 0.02 days. Result: current performance is 2.98 days below the 2 day target.

### test coverage
Observed: lines average was 82.05%. Result: performance is 12.05% above the 70% target.
Observed: functions average was 85%. Result: no target defined for functions.
Observed: branches average was 65.27%. Result: no target defined for branches.
Observed: statements average was 82.05%. Result: no target defined for statements.

### AI spend
Observed: spend_usd is 1.5958 for the current partial month. Result: no multi-month trend can be established; current spend is 8.4042 below the 10 baseline.

## Data quality
Security findings: no automated collector writes to metrics/, so the 5 to <2 baseline/target cannot be assessed.
AI spend: token utilisation needs OPENROUTER_MANAGEMENT_KEY.
AI usage history: no monthly history exists; no multi-month trend can be established.

## What to watch next quarter
1. Setup OPENROUTER_MANAGEMENT_KEY to resolve AI spend and history gaps.
2. Implement automated collector for security findings to track the 5 to <2 target.
3. Monitor monthly spend to ensure it remains below the 40 alert threshold.

---
_Tables are generated deterministically from `metrics/*.csv` and the OpenRouter usage API._ 
_The analysis above was drafted by the model from the fact sheet JSON only and may contain errors; verify against the tables before acting on it._
