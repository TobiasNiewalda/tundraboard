// Fetches this month's AI spend and token utilisation from the OpenRouter API
// and prints a clean Markdown snippet for analysis.md.
//
//   npm run ai:usage                          # or: node scripts/fetch_ai_usage.js
//   node scripts/fetch_ai_usage.js >> analysis.md
//
// Environment (a local .env is loaded when present, see .env.example):
//   OPENROUTER_API_KEY         required - spend data comes from GET /key, which
//                              works with a normal inference key.
//   OPENROUTER_MANAGEMENT_KEY  optional - unlocks the Analytics API (token
//                              utilisation, per-model breakdown) and account
//                              credits. Create one under openrouter.ai ->
//                              Settings -> API Keys -> Manage.
//   OPENROUTER_BASE_URL        optional - defaults to https://openrouter.ai/api/v1
//
// Exit codes: 0 success | 2 configuration error | 1 API failure.
//
// Design notes:
// - Analytics metric names are resolved from GET /analytics/meta at runtime
//   (hardcoded names as fallback), so an upstream rename degrades to a missing
//   column instead of a crash.
// - A missing/invalid management key is not fatal: the script still prints the
//   spend snippet from GET /key and explains what the full key would unlock.

"use strict";

try {
  require("dotenv").config();
} catch {
  // dotenv is optional for this script; env vars can come from the shell too.
}

const BASE_URL = (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
const ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 20_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
const isCost = (name) => /(?:spend|cost)/.test(name);
const isTokens = (name) => /token/.test(name);

// Pretty labels for known analytics metrics; anything else keeps its raw name.
const METRIC_LABELS = {
  request_count: "Requests",
  spend: "Spend",
  native_tokens_prompt: "Prompt tokens",
  native_tokens_completion: "Completion tokens",
  native_tokens_reasoning: "Reasoning tokens",
  native_tokens_cached: "Cached prompt tokens",
  native_tokens: "Total tokens",
};
const label = (name) => METRIC_LABELS[name] || name;

/**
 * Chooses the metric names to query from what /analytics/meta advertises
 * (additive metrics only). Falls back to the names known when this was written
 * if meta returns nothing useful.
 */
function selectMetrics(metaMetrics) {
  if (!Array.isArray(metaMetrics) || metaMetrics.length === 0) {
    return [
      "request_count",
      "spend",
      "native_tokens_prompt",
      "native_tokens_completion",
      "native_tokens_reasoning",
    ];
  }
  const additive = metaMetrics.filter((m) => m && m.name && !m.is_rate);
  const names = (re, limit = Infinity) => additive.filter((m) => re.test(m.name)).map((m) => m.name).slice(0, limit);
  const chosen = [...names(/^request_count$/), ...names(/(?:^|_)(?:spend|cost)(?:$|_)/, 1), ...names(/token/, 6)];
  return chosen.length ? chosen : ["request_count"]; // a query needs >= 1 metric
}

/**
 * POSTs an analytics query over the current month, dropping the last metric
 * and retrying while OpenRouter rejects an unknown metric name with 400.
 */
async function runQuery(token, body, metrics) {
  let names = metrics.slice();
  for (;;) {
    try {
      const res = await api("/analytics/query", { token, method: "POST", body: { ...body, metrics: names } });
      return { rows: res?.data?.data ?? [], names };
    } catch (err) {
      if (!err.badRequest || names.length <= 1) throw err;
      const dropped = names.pop();
      console.error(`Analytics metric "${dropped}" not accepted; dropping it and retrying.`);
    }
  }
}

/** Sums a metric over rows, treating missing/non-numeric values as 0. */
const sum = (rows, name) => rows.reduce((acc, r) => acc + (Number(r[name]) || 0), 0);
/** Number formatter appropriate for the given metric name. */
const fmtFor = (metric) => (isCost(metric) ? usd : isTokens(metric) ? tokens : int);

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    fail(2, "OPENROUTER_API_KEY is not set. Add it to .env or export it (see docs/metrics-setup.md).");
  }
  const analyticsToken = process.env.OPENROUTER_MANAGEMENT_KEY || apiKey;

  // Current UTC month window. The analytics API requires second precision
  // (YYYY-MM-DDTHH:MM:SSZ), so strip milliseconds from toISOString().
  const now = new Date();
  const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
  const month = now.toISOString().slice(0, 7);
  const timeRange = { start: `${month}-01T00:00:00Z`, end: iso(now) };

  let keyInfo;
  try {
    keyInfo = (await api("/key", { token: apiKey })).data || {};
  } catch (err) {
    fail(1, err.auth ? `OPENROUTER_API_KEY was rejected: ${err.message}` : `Could not reach OpenRouter: ${err.message}`);
  }

  const totals = {};
  let names = [];
  let spendSource = "";
  let topModels = null;
  let analyticsNote = null;

  try {
    const meta = await api("/analytics/meta", { token: analyticsToken });
    names = selectMetrics(meta?.data?.metrics);

    const monthData = await runQuery(analyticsToken, { granularity: "month", limit: 400, time_range: timeRange }, names);
    // Keep the current month's rows in case the range crosses a boundary.
    const currentMonth = monthData.rows.filter((r) => !r.date__month || String(r.date__month).startsWith(month));
    const rows = currentMonth.length ? currentMonth : monthData.rows;
    for (const name of monthData.names) totals[name] = sum(rows, name);
    names = monthData.names;

    if (!names.some(isCost)) {
      // No accepted cost metric: fall back to this key's own monthly usage.
      totals.spend = keyInfo.usage_monthly ?? 0;
      names = ["spend", ...names];
      spendSource = "Spend is this key's monthly usage; the Analytics API exposed no cost metric.";
    }
    if (totals.native_tokens_prompt !== undefined && totals.native_tokens_completion !== undefined) {
      // reasoning/cached are subsets of those two, so total = prompt + completion.
      totals.__totalTokens = totals.native_tokens_prompt + totals.native_tokens_completion;
      names.push("__totalTokens");
    }

    const costField = names.find(isCost) || "request_count";
    topModels = await runQuery(
      analyticsToken,
      {
        dimensions: ["model"],
        limit: 8,
        order_by: { field: costField, direction: "desc" },
        time_range: timeRange,
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

  const lines = ["## AI Tool Spend/Usage", "", "| Metric | This month |", "| --- | ---: |"];
  for (const name of names) {
    if (name === "__totalTokens" || totals[name] === undefined) continue;
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
  if (facts.length) lines.push("", ...facts.map((f) => `- ${f}`));

  lines.push("", `<!-- Generated ${now.toISOString()} by scripts/fetch_ai_usage.js (month ${month} UTC) -->`, "");
  process.stdout.write(lines.join("\n"));
}

main().catch((err) => fail(1, `Could not fetch OpenRouter usage: ${err.message}`));
