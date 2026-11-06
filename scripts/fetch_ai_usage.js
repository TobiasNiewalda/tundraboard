// Fetches AI spend and token utilisation from the OpenRouter API and prints a
// clean, current-month Markdown snippet for analysis.md.
//
//   npm run ai:usage                          # or: node scripts/fetch_ai_usage.js
//   node scripts/fetch_ai_usage.js >> analysis.md
//
// Environment (a local .env is loaded when present, see .env.example):
//   OPENROUTER_API_KEY         required - spend data comes from GET /key, which
//                              works with a normal inference key.
//   OPENROUTER_MANAGEMENT_KEY  optional - unlocks the Analytics API (token
//                              utilisation, per-model breakdown, monthly
//                              history) and account credits. Create one under
//                              openrouter.ai -> Settings -> API Keys -> Manage.
//   OPENROUTER_BASE_URL        optional - defaults to https://openrouter.ai/api/v1
//   AI_USAGE_LOOKBACK_MONTHS   optional - months of history collectFacts()
//                              collects (complete months + the current month to
//                              date). Default 4 = 3 complete + current MTD;
//                              clamped to 1..24. It does NOT change the printed
//                              snippet, which is always the single-month view.
//
// Exit codes: 0 success | 2 configuration error | 1 API failure.
//
// Design notes:
// - Analytics metric names are resolved from GET /analytics/meta at runtime
//   (hardcoded names as fallback), so an upstream rename degrades to a missing
//   column instead of a crash. The spend metric is detected by currency
//   display format or by name (spend / cost / total_usage — OpenRouter renamed
//   "spend" to "total_usage").
// - One granularity="month" query covers the whole lookback window; its rows
//   split into the current-month snapshot (rendered, and kept in `totals`
//   unchanged) and `history` for programmatic consumers — currently only
//   generate-fact-sheet.mjs. The snippet stays single-month on purpose.
// - When the response reports metadata.truncated, the affected totals are
//   flagged (snippet bullet + history.truncated) instead of silently
//   undercounting.
// - A missing/invalid management key is not fatal: the script still prints the
//   spend snippet from GET /key and explains what the full key would unlock;
//   history stays null.

"use strict";

try {
  require("dotenv").config();
} catch {
  // dotenv is optional for this script; env vars can come from the shell too.
}

const BASE_URL = (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
const ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 20_000;
const DEFAULT_LOOKBACK_MONTHS = 4; // 3 complete months + the current month-to-date
const MAX_LOOKBACK_MONTHS = 24;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** History window in months from AI_USAGE_LOOKBACK_MONTHS (default 4, max 24). */
function lookbackMonths() {
  const n = Number.parseInt(process.env.AI_USAGE_LOOKBACK_MONTHS, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LOOKBACK_MONTHS;
  return Math.min(n, MAX_LOOKBACK_MONTHS);
}

function fail(code, message) {
  console.error(message);
  process.exit(code);
}

/**
 * GET/POST with a per-attempt timeout; retries 429/5xx/network errors with
 * backoff. Auth errors (401/403) and 400s are thrown immediately, flagged on
 * `err.auth` / `err.badRequest` so callers can decide how to degrade.
 */
async function api(path, { token, method = "GET", body } = {}) {
  let last = `OpenRouter ${method} ${path} failed.`;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    let wait = 1000 * 2 ** (attempt - 1);
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        method,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/json",
          ...(body ? { "content-type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.ok) return res.json();
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      if (res.status === 401 || res.status === 403) {
        const err = new Error(`OpenRouter rejected the credentials (${res.status}): ${detail}`);
        err.auth = true;
        throw err;
      }
      if (res.status === 400) {
        const err = new Error(`OpenRouter 400 on ${path}: ${detail}`);
        err.badRequest = true;
        throw err;
      }
      last = `OpenRouter ${method} ${path} returned ${res.status}: ${detail}`;
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after"));
        if (retryAfter > 0) wait = Math.min(retryAfter, 30) * 1000;
      } else if (res.status < 500) {
        throw new Error(last); // other 4xx: retrying changes nothing
      }
    } catch (err) {
      if (err.auth || err.badRequest) throw err;
      if (err.name === "TimeoutError" || err.name === "AbortError") last = `OpenRouter ${path} timed out.`;
      else if (!last.startsWith("OpenRouter")) last = `OpenRouter ${path} unreachable: ${err.message}`;
    }
    if (attempt < ATTEMPTS) {
      console.error(`Retrying ${path} in ${wait / 1000}s (${last})`);
      await sleep(wait);
    }
  }
  throw new Error(last);
}

const usd = (n) => `$${Math.abs(n) >= 0.01 ? n.toFixed(2) : n.toFixed(4)}`;
const int = (n) => Math.round(n).toLocaleString("en-US");
function tokens(n) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(Math.round(n));
}
// "total_usage" is OpenRouter's current name for the account spend metric;
// "spend"/"cost" keep older spellings (and the injected fallback) detected.
const isCost = (name) => /(?:spend|cost|total_usage)/.test(name);
const isTokens = (name) => /token/.test(name);

// Pretty labels for known analytics metrics; anything else keeps its raw name.
const METRIC_LABELS = {
  request_count: "Requests",
  spend: "Spend",
  total_usage: "Spend",
  native_tokens_prompt: "Prompt tokens",
  native_tokens_completion: "Completion tokens",
  native_tokens_reasoning: "Reasoning tokens",
  native_tokens_cached: "Cached prompt tokens",
  tokens_total: "Total tokens",
  native_tokens: "Total tokens",
};
const label = (name) => METRIC_LABELS[name] || name;

/**
 * Chooses the metric names to query from what /analytics/meta advertises
 * (additive metrics only). The cost metric is recognised by its currency
 * display format first and by name second, so the spend row survives
 * OpenRouter's spend → total_usage rename. If meta returns nothing useful,
 * falls back to the known names — current spellings first, because
 * runQuery() drops metrics from the end while the API rejects unknown ones,
 * so a stale API drops the legacy names and a renamed API keeps the valid
 * current ones.
 */
function selectMetrics(metaMetrics) {
  if (!Array.isArray(metaMetrics) || metaMetrics.length === 0) {
    return [
      "request_count",
      "total_usage",
      "tokens_total",
      "spend",
      "native_tokens_prompt",
      "native_tokens_completion",
    ];
  }
  const additive = metaMetrics.filter((m) => m && m.name && !m.is_rate);
  const names = (re, limit = Infinity) => additive.filter((m) => re.test(m.name)).map((m) => m.name).slice(0, limit);
  const cost = additive.find(
    (m) => m.display_format === "currency" || /(?:^|_)(?:spend|cost|total_usage)(?:$|_)/.test(m.name),
  );
  const chosen = [...names(/^request_count$/), ...(cost ? [cost.name] : []), ...names(/token/, 6)];
  return chosen.length ? chosen : ["request_count"]; // a query needs >= 1 metric
}

/**
 * POSTs an analytics query, dropping the last metric and retrying while
 * OpenRouter rejects an unknown metric name with 400. Also surfaces
 * metadata.truncated — the API row cap silently omits rows, so callers must
 * not present a possibly-undercounted sum as complete.
 */
async function runQuery(token, body, metrics) {
  let names = metrics.slice();
  for (;;) {
    try {
      const res = await api("/analytics/query", { token, method: "POST", body: { ...body, metrics: names } });
      return { rows: res?.data?.data ?? [], names, truncated: res?.data?.metadata?.truncated === true };
    } catch (err) {
      if (!err.badRequest || names.length <= 1) throw err;
      const dropped = names.pop();
      console.error(`Analytics metric "${dropped}" not accepted; dropping it and retrying.`);
    }
  }
}

/** Keeps only the first accepted cost metric, so a spend column is never
 *  double-reported when several cost-named metrics pass the 400-drop loop. */
function keepFirstCostMetric(query) {
  const costs = query.names.filter(isCost);
  if (costs.length < 2) return query;
  const drop = new Set(costs.slice(1));
  return { ...query, names: query.names.filter((n) => !drop.has(n)) };
}

/** Sums a metric over rows, treating missing/non-numeric values as 0. */
const sum = (rows, name) => rows.reduce((acc, r) => acc + (Number(r[name]) || 0), 0);
/** Number formatter appropriate for the given metric name. */
const fmtFor = (metric) => (isCost(metric) ? usd : isTokens(metric) ? tokens : int);

/**
 * Collects the current UTC month's facts — plus a monthly history over the
 * lookback window for trend consumers — and returns them structured (no
 * rendering) so other scripts can reuse them: see generate-fact-sheet.mjs.
 * Errors carry `exitCode` (2 config, 1 API) for main() to translate.
 */
async function collectFacts() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    const err = new Error("OPENROUTER_API_KEY is not set. Add it to .env or export it (see docs/metrics-setup.md).");
    err.exitCode = 2;
    throw err;
  }
  const analyticsToken = process.env.OPENROUTER_MANAGEMENT_KEY || apiKey;

  // Current UTC month and the history window (complete months + current MTD).
  // The analytics API requires second precision (YYYY-MM-DDTHH:MM:SSZ), so
  // strip milliseconds from toISOString().
  const now = new Date();
  const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
  const month = now.toISOString().slice(0, 7);
  const lookback = lookbackMonths();
  const windowMonths = Array.from({ length: lookback }, (_, i) =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (lookback - 1 - i), 1)).toISOString().slice(0, 7),
  );
  const currentRange = { start: `${month}-01T00:00:00Z`, end: iso(now) };
  const windowRange = { start: `${windowMonths[0]}-01T00:00:00Z`, end: iso(now) };

  let keyInfo;
  try {
    keyInfo = (await api("/key", { token: apiKey })).data || {};
  } catch (err) {
    const wrapped = new Error(
      err.auth ? `OPENROUTER_API_KEY was rejected: ${err.message}` : `Could not reach OpenRouter: ${err.message}`,
    );
    wrapped.exitCode = 1;
    throw wrapped;
  }

  const totals = {};
  let names = [];
  let spendSource = "";
  let topModels = null;
  let analyticsNote = null;
  let history = null;

  try {
    const meta = await api("/analytics/meta", { token: analyticsToken });
    names = selectMetrics(meta?.data?.metrics);

    const queryMonths = async (time_range) =>
      keepFirstCostMetric(
        await runQuery(analyticsToken, { granularity: "month", limit: 400, time_range }, names),
      );

    // One month-granularity query over the whole lookback window serves both
    // the current-month snapshot and the history. If OpenRouter rejects the
    // multi-month range, degrade to the current month only rather than lose
    // tokens/requests for management-key accounts entirely.
    let monthData;
    let historyMonths;
    try {
      monthData = await queryMonths(windowRange);
      historyMonths = windowMonths;
    } catch (err) {
      if (!err.badRequest) throw err;
      console.error(`OpenRouter rejected the ${windowMonths[0]} → ${month} window; using the current month only.`);
      monthData = await queryMonths(currentRange);
      historyMonths = [month];
    }

    // Bucket the monthly rows by UTC calendar month: the current month
    // becomes the rendered snapshot, all months become the history.
    const byMonth = new Map();
    for (const r of monthData.rows) {
      const key = r.date__month ? String(r.date__month).slice(0, 7) : month;
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key).push(r);
    }
    // A month the API omitted entirely had no usage — its sums aggregate to 0.
    const rows = byMonth.get(month) ?? monthData.rows.filter((r) => !r.date__month);
    for (const name of monthData.names) totals[name] = sum(rows, name);
    names = monthData.names;
    const analyticsHasCost = names.some(isCost);

    if (!analyticsHasCost) {
      // No accepted cost metric: fall back to this key's own monthly usage.
      totals.spend = keyInfo.usage_monthly ?? 0;
      names = ["spend", ...names];
      spendSource = "Spend is this key's monthly usage; the Analytics API exposed no cost metric.";
    }
    if (totals.tokens_total !== undefined) {
      totals.__totalTokens = totals.tokens_total;
      names.push("__totalTokens");
    } else if (totals.native_tokens_prompt !== undefined && totals.native_tokens_completion !== undefined) {
      // reasoning/cached are subsets of those two, so total = prompt + completion.
      totals.__totalTokens = totals.native_tokens_prompt + totals.native_tokens_completion;
      names.push("__totalTokens");
    }

    const costMetric = names.find(isCost);
    history = {
      window: { months: historyMonths.length, start: historyMonths[0], end: month },
      truncated: monthData.truncated,
      rows: historyMonths.map((m) => {
        const inMonth = (metric) => sum(byMonth.get(m) ?? [], metric);
        let monthTokens = null;
        if (names.includes("tokens_total")) monthTokens = inMonth("tokens_total");
        else if (names.includes("native_tokens_prompt") && names.includes("native_tokens_completion"))
          monthTokens = inMonth("native_tokens_prompt") + inMonth("native_tokens_completion");
        return {
          month: m,
          complete: m !== month,
          // Key-level fallback spend only covers the current month: earlier
          // months stay null instead of pretending a zero month was real.
          spend_usd: analyticsHasCost ? inMonth(costMetric) : m === month ? totals.spend : null,
          total_tokens: monthTokens,
          requests: names.includes("request_count") ? inMonth("request_count") : null,
        };
      }),
    };

    const costField = names.find(isCost) || "request_count";
    topModels = await runQuery(
      analyticsToken,
      {
        dimensions: ["model"],
        limit: 8,
        order_by: { field: costField, direction: "desc" },
        time_range: currentRange,
      },
      names.filter((n) => n !== "__totalTokens"),
    );
  } catch (err) {
    // Token utilisation and per-model spend are management-key features.
    // Degrade to key-level spend instead of failing the snippet.
    analyticsNote = err.auth
      ? "Token utilisation and per-model spend need a management key; set OPENROUTER_MANAGEMENT_KEY (see docs/metrics-setup.md)."
      : `Analytics query failed; showing key spend only: ${err.message}`;
    names = ["spend"];
    totals.spend = keyInfo.usage_monthly ?? 0;
    spendSource = "Spend is this key's monthly usage (UTC month).";
  }

  // Account-level context lines.
  const facts = [];
  if (!analyticsNote) {
    try {
      const credits = (await api("/credits", { token: analyticsToken })).data || {};
      if (typeof credits.total_credits === "number") {
        facts.push(
          `Account credit balance: ${usd(credits.total_credits - (credits.total_usage || 0))} ` +
            `remaining of ${usd(credits.total_credits)} purchased.`,
        );
      }
    } catch {
      // Context only; a 403 here just omits the balance line.
    }
  }
  if (keyInfo.limit != null) {
    const reset = keyInfo.limit_reset ? `, resets ${keyInfo.limit_reset}` : "";
    facts.push(`Key spend limit: ${usd(keyInfo.limit)}${reset}; ${usd(keyInfo.limit_remaining ?? 0)} remaining.`);
  }
  if (history?.truncated) {
    facts.push("The Analytics API truncated the monthly result set; monthly totals may be undercounts.");
  }
  if (topModels?.truncated) {
    facts.push("The top-models query hit the analytics row limit; the model list may not cover every model.");
  }

  return { now, month, lookback, keyInfo, names, totals, spendSource, analyticsNote, topModels, facts, history };
}

/**
 * Renders the collectFacts() result as the Markdown snippet for analysis.md.
 * Deliberately single-month: the multi-month `history` in the facts is for
 * programmatic consumers (generate-fact-sheet.mjs), not for this snippet.
 */
function renderSnippet(f) {
  const { month, names, totals, spendSource, analyticsNote, topModels, facts } = f;
  const lines = ["## AI Tool Spend/Usage", "", "| Metric | This month |", "| --- | ---: |"];
  for (const name of names) {
    // __totalTokens is the synthetic row below; tokens_total is the same
    // number from the API and would double-report it.
    if (name === "__totalTokens" || name === "tokens_total" || totals[name] === undefined) continue;
    lines.push(`| ${label(name)} | ${fmtFor(name)(totals[name])} |`);
  }
  if (totals.__totalTokens !== undefined) lines.push(`| **Total tokens** | **${tokens(totals.__totalTokens)}** |`);
  if (spendSource) lines.push("", `_${spendSource}_`);
  if (analyticsNote) lines.push("", `> ℹ️ ${analyticsNote}`);

  if (topModels && topModels.rows.length) {
    const cols = topModels.names;
    lines.push(
      "",
      `### Top models in ${month} (UTC)`,
      "",
      `| Model | ${cols.map(label).join(" | ")} |`,
      `| --- |${cols.map(() => " ---: |").join("")}`,
    );
    for (const r of topModels.rows) {
      lines.push(`| ${r.model ?? "unknown"} | ${cols.map((c) => fmtFor(c)(Number(r[c]) || 0)).join(" | ")} |`);
    }
  }

  if (facts.length) lines.push("", ...facts.map((line) => `- ${line}`));

  lines.push("", `<!-- Generated ${f.now.toISOString()} by scripts/fetch_ai_usage.js (month ${month} UTC) -->`, "");
  return lines;
}

async function main() {
  try {
    process.stdout.write(renderSnippet(await collectFacts()).join("\n"));
  } catch (err) {
    const msg = err.exitCode === 2 ? err.message : `Could not fetch OpenRouter usage: ${err.message}`;
    fail(err.exitCode || 1, msg);
  }
}

// Only print the snippet when invoked directly; generate-fact-sheet.mjs imports collectFacts.
if (require.main === module) {
  main();
}

module.exports = { collectFacts };
