/**
 * generate-fact-sheet.mjs — the "Hard Facts" input for the AI Impact Report.
 * Reads metrics/coverage.csv and metrics/cycle_time.csv, computes average /
 * latest / delta-vs-period-start for each series, pulls the current month's
 * OpenRouter spend and token usage through the logic in fetch_ai_usage.js
 * (plus a monthly history — 3 complete months + the current month to date by
 * default, see AI_USAGE_LOOKBACK_MONTHS), computes the month-over-month trend
 * (delta, % change, direction) so the analysis model never has to do math,
 * and attaches the baseline/3-month targets from
 * `docs/course_materials/Chapter 5/Lesson 2/analysis.md` as the benchmark.
 *
 * Deliberately numbers-only and deterministic: nothing here calls an LLM.
 * Missing sources never crash the run — they become entries in "gaps" so the
 * report can say "no data" honestly instead of inventing a trend. Without a
 * management key there is no Analytics API, so `ai_usage.history` is null and
 * a gap line explains it; all existing scalars stay unchanged.
 *
 * Usage:
 *   node scripts/generate-fact-sheet.mjs > fact-sheet.json
 *   npm run report:facts -- out.json          # or write via OUT / first arg
 *
 * Environment (same as scripts/fetch_ai_usage.js):
 *   OPENROUTER_API_KEY  optional here — without it, ai_usage is null and a
 *                       gap line explains why.
 *   OPENROUTER_MANAGEMENT_KEY optional — unlocks tokens/requests breakdown
 *                       and the monthly history the trend is computed from.
 *   AI_USAGE_LOOKBACK_MONTHS optional — history window (default 4).
 *
 * Exit codes: 0 fact sheet produced (possibly with gaps); 1 internal error.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { collectFacts } from "./fetch_ai_usage.js";

// Reporting window: one quarter, ending today (UTC). Rows older than this are
// excluded from the trend so "delta vs start of period" stays meaningful.
const PERIOD_DAYS = 92;
const COVERAGE_CSV = "metrics/coverage.csv";
const CYCLE_CSV = "metrics/cycle_time.csv";

// Benchmarks transcribed from docs/course_materials/Chapter 5/Lesson 2/analysis.md.
// direction: which way is "good" for this metric.
const TARGETS = {
  cycle_time_days: { baseline: 3, target: 2, direction: "down" },
  test_coverage_lines_pct: { baseline: 40, target: 70, direction: "up" },
  security_findings: { baseline: 5, target: 2, direction: "down", note: "target is fewer than 2 open medium/high findings" },
  prompts_per_day: { baseline: 20, target: 50, direction: "up", note: "AI usage requests/day is the available proxy" },
  monthly_spend_usd: {
    baseline: 10,
    target: 25,
    direction: "either",
    note: "cost follows usage; alert threshold is > $40/month without a cycle-time improvement",
  },
};

const round = (n, d = 2) => Number(n.toFixed(d));

/** Parse a simple CSV (no quoted fields in these files) into row objects. */
function readCsv(path) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return { rows: [], error: `${path} is missing — no collector has written it yet.` };
  }
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], error: `${path} has no data rows.` };
  const cols = lines[0].split(",");
  return { rows: lines.slice(1).map((l) => Object.fromEntries(l.split(",").map((v, i) => [cols[i], v]))), error: null };
}

/** Keep rows whose `date` column falls inside the last PERIOD_DAYS days, oldest first. */
function withinPeriod(rows, cutoff) {
  return rows
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date ?? "") && r.date >= cutoff)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Average/latest/first/delta stats over an ordered list of numbers. */
function stats(values) {
  if (!values.length) return null;
  const numeric = {
    observations: values.length,
    first: round(values[0]),
    latest: round(values.at(-1)),
    average: round(values.reduce((a, b) => a + b, 0) / values.length),
  };
  numeric.delta = round(numeric.latest - numeric.first);
  return numeric;
}

function coverageFacts(gaps) {
  const { rows, error } = readCsv(COVERAGE_CSV);
  if (error) {
    gaps.push(`Test coverage: ${error}`);
    return { unit: "percent", series: null };
  }
  const period = withinPeriod(rows, cutoffDate());
  const source = (period.length ? period : rows).slice().sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  if (!period.length) gaps.push(`Test coverage: no rows in the last ${PERIOD_DAYS} days; trend covers all ${rows.length} rows instead.`);
  const series = {};
  for (const column of ["lines", "functions", "branches", "statements"]) {
    const s = stats(source.map((r) => Number(r[column])).filter(Number.isFinite));
    if (s) series[column] = s;
    else gaps.push(`Test coverage: column "${column}" has no numeric rows in the period.`);
  }
  if (source.length < 3) gaps.push(`Test coverage: only ${source.length} observation(s) — not enough to establish a trend.`);
  return { unit: "percent", period_rows: source.length, series: Object.keys(series).length ? series : null };
}

function cycleTimeFacts(gaps) {
  const { rows, error } = readCsv(CYCLE_CSV);
  if (error) {
    gaps.push(`Cycle time: ${error}`);
    return { unit: "days", series: null };
  }
  const period = withinPeriod(rows, cutoffDate());
  const source = (period.length ? period : rows).slice().sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  if (!period.length) gaps.push(`Cycle time: no PRs merged in the last ${PERIOD_DAYS} days; trend covers all ${rows.length} rows instead.`);
  const merged = source.filter((r) => Number.isFinite(Number(r.duration_days)));
  const s = stats(merged.map((r) => Number(r.duration_days)));
  if (!s) gaps.push("Cycle time: no parseable duration_days rows.");
  else if (s.observations < 3) gaps.push(`Cycle time: only ${s.observations} merged PR(s) — not enough to establish a trend.`);
  return { unit: "days", period_rows: merged.length, series: s ? { duration_days: s } : null };
}

/**
 * Current-month spend/tokens via fetch_ai_usage.js's collector, plus the
 * monthly history it collected — with the month-over-month trend computed
 * here (not by the model). Degrades to null + a gap line when no key is
 * configured or the API is unreachable, and to a missing history (null) when
 * there is no management key, so the fact sheet still builds.
 */
async function usageFacts(gaps) {
  if (!process.env.OPENROUTER_API_KEY) {
    gaps.push("AI spend and token usage: OPENROUTER_API_KEY not set, so OpenRouter facts are missing this run.");
    return null;
  }
  let f;
  try {
    f = await collectFacts();
  } catch (err) {
    gaps.push(`AI spend and token usage: OpenRouter lookup failed (${err.message}).`);
    return null;
  }
  const t = f.totals;
  const daysElapsed = Number(f.now.toISOString().slice(8, 10));
  const requests = Number.isFinite(t.request_count) ? t.request_count : null;
  const spendMetric = f.names.find((n) => /(?:spend|cost|total_usage)/.test(n));
  const months = f.history
    ? f.history.rows.map((r) => ({
        month: r.month,
        complete: r.complete,
        spend_usd: r.spend_usd === null ? null : round(r.spend_usd, 4),
        total_tokens: r.total_tokens === null ? null : Math.round(r.total_tokens),
        requests: r.requests === null ? null : Math.round(r.requests),
      }))
    : null;
  const trend = months ? monthTrend(months) : null;
  const usage = {
    month: f.month,
    spend_usd: spendMetric ? round(Number(t[spendMetric] ?? 0), 4) : null,
    total_tokens: Number.isFinite(t.__totalTokens) ? Math.round(t.__totalTokens) : null,
    prompt_tokens: Number.isFinite(t.native_tokens_prompt) ? Math.round(t.native_tokens_prompt) : null,
    completion_tokens: Number.isFinite(t.native_tokens_completion) ? Math.round(t.native_tokens_completion) : null,
    requests,
    requests_per_day: requests === null ? null : round(requests / daysElapsed),
    month_days_elapsed: daysElapsed,
    top_models: (f.topModels?.rows ?? [])
      .slice(0, 5)
      .map((r) => ({ model: r.model ?? "unknown", spend_usd: round(Number(r[spendMetric] ?? 0), 4) })),
    history: months
      ? {
          window_months: f.history.window.months,
          start: f.history.window.start,
          end: f.history.window.end,
          truncated: f.history.truncated,
          basis:
            "trend compares the latest complete month to the complete month before it; " +
            "months with complete=false are the current month in progress (month to date) and are excluded from the trend",
          months,
          trend,
        }
      : null,
    caveats: [f.spendSource, f.analyticsNote].filter(Boolean),
  };
  if (usage.total_tokens === null && usage.requests === null) {
    gaps.push("AI spend: only spend could be read; token utilisation needs OPENROUTER_MANAGEMENT_KEY (see docs/metrics-setup.md).");
  }
  if (!months) {
    gaps.push("AI usage history: no monthly history this run — it needs the Analytics API (OPENROUTER_MANAGEMENT_KEY); judge the current month against targets only.");
  } else if (!trend) {
    const completeMonths = months.filter((m) => m.complete).length;
    gaps.push(
      `AI usage history: only ${completeMonths} complete month(s) in the ${f.history.window.months}-month window — not enough for a month-over-month trend.`,
    );
  }
  if (f.history?.truncated) {
    usage.caveats.push("The Analytics API truncated the monthly result set; history totals may be undercounts.");
  }
  return usage;
}

/** Decimal places per trended metric when rounding: money to 4, counts to 0. */
const TREND_METRICS = { spend_usd: 4, total_tokens: 0, requests: 0 };

/**
 * Month-over-month trend from a monthly history: the latest COMPLETE month
 * against the complete month before it. Month-to-date months (complete=false)
 * are never compared — a partial month against a full one always looks like a
 * drop, which is exactly the arithmetic the model must not be left to do.
 * Per metric: null when either month lacks the value (e.g. key-level spend
 * fallback has no per-month history); the whole trend is null when fewer than
 * two complete months exist or nothing is computable.
 */
export function monthTrend(months) {
  const full = months.filter((m) => m.complete);
  if (full.length < 2) return null;
  const from = full.at(-2);
  const to = full.at(-1);
  const trend = {};
  for (const [key, dp] of Object.entries(TREND_METRICS)) {
    const a = from[key];
    const b = to[key];
    if (a === null || a === undefined || b === null || b === undefined) {
      trend[key] = null;
      continue;
    }
    const delta = b - a;
    trend[key] = {
      from_month: from.month,
      to_month: to.month,
      from: round(a, dp),
      to: round(b, dp),
      delta: round(delta, dp),
      pct_change: a === 0 ? null : round((delta / Math.abs(a)) * 100, 1),
      direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
    };
  }
  return Object.values(trend).some((v) => v !== null) ? trend : null;
}

const cutoffDate = () => new Date(Date.now() - PERIOD_DAYS * 86_400_000).toISOString().slice(0, 10);

async function buildFactSheet() {
  const gaps = [];
  const now = new Date();
  return {
    generated_at: now.toISOString(),
    period: { days: PERIOD_DAYS, start: cutoffDate(), end: now.toISOString().slice(0, 10) },
    metrics: {
      test_coverage: coverageFacts(gaps),
      cycle_time: cycleTimeFacts(gaps),
      ai_usage: await usageFacts(gaps),
    },
    targets: TARGETS,
    gaps: ["Security findings: no automated collector writes to metrics/, so the 5 → <2 baseline/target cannot be assessed.", ...gaps],
    sources: {
      test_coverage: COVERAGE_CSV,
      cycle_time: CYCLE_CSV,
      ai_usage: "OpenRouter API via scripts/fetch_ai_usage.js",
      targets: "docs/course_materials/Chapter 5/Lesson 2/analysis.md",
    },
  };
}

const factSheet = await buildFactSheet();
const json = JSON.stringify(factSheet, null, 2);
const out = process.argv[2] || process.env.OUT;
if (out) {
  writeFileSync(out, `${json}\n`);
  console.log(`Fact sheet written to ${out}`);
} else {
  process.stdout.write(`${json}\n`);
}
