/**
 * metrics-coverage.mjs — the "Test Coverage" bookkeeping that used to live as
 * inline bash in .github/workflows/ci.yml and metrics-coverage.yml. Running it
 * in Node (via scripts/lib/ai-client.mjs, the same GitHub helper the proven
 * ai-review.mjs uses) removes the `gh`/`awk` quoting that kept producing 404s.
 *
 * Each part activates from the environment of the workflow that calls it:
 *
 *   PR_NUMBER set  → upsert the top-level PR comment: find the existing comment
 *                    containing `<!-- coverage-report -->`, PATCH it; otherwise
 *                    POST a new one. Body = coverage-summary.mjs markdown, same
 *                    as the old bash produced.
 *
 *   LOG_CSV=1      → append this run's totals to metrics/coverage.csv (creating
 *                    the dir/header first). Skips silently if the commit is
 *                    already recorded (concurrent runs). If lines coverage fell
 *                    more than 5 pp since the previous row, emits ::warning::
 *                    (the alert threshold from analysis.md) and flags the drop
 *                    in the step summary. Writes the row to $GITHUB_ENV as ROW=
 *                    for the commit-and-push step to replay after a re-sync.
 *
 * Required env: GITHUB_SHA; CSV path: LOG_CSV=1 (optional CSV=…, default
 * metrics/coverage.csv); comment path: PR_NUMBER, REPO, GITHUB_TOKEN (with the
 * job's `pull-requests: write` permission).
 *
 * Exit codes: 0 success or nothing to do; 1 coverage report unreadable, missing
 * env, or a GitHub API failure — the same fail-hard semantics the bash steps had.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { github, githubList, githubRequest } from "./lib/ai-client.mjs";
import { buildCsvRow, readTotals, renderMarkdown } from "./coverage-summary.mjs";

const MARKER = "<!-- coverage-report -->";
const CSV_HEADER = "date,commit,lines,functions,branches,statements";
// Chapter 5 Lesson 2 alert threshold: > 5 pp lines-coverage drop in one merge.
const ALERT_DROP_PP = 5;

const env = process.env;
const csvPath = resolve(env.CSV || "metrics/coverage.csv");
const csvLabel = env.CSV || "metrics/coverage.csv";
const sha = env.GITHUB_SHA ?? "";
const sha7 = sha.slice(0, 7);

const wantCsvLog = env.LOG_CSV === "1";
const wantComment = Boolean(env.PR_NUMBER);

/** Append to the workflow step summary when running inside Actions. */
function appendStepSummary(text) {
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, text);
}

/** The PR comment body: markdown table, provenance note, hidden upsert marker. */
function commentBody(totals) {
  return [
    renderMarkdown(totals, `Test coverage @ ${sha7}`).trimEnd(),
    "",
    "_From `npm run test:coverage` (thresholds in `vitest.config.ts`). ",
    "Merged commits are also logged to `metrics/coverage.csv`._",
    "",
    MARKER,
  ].join("\n");
}

/** Find the marker comment (the newest one, like the old `--jq … | last`), then update or create. */
async function upsertPrComment(totals) {
  if (!/^\d+$/.test(env.PR_NUMBER ?? "")) {
    throw new Error(`PR_NUMBER must be a number, got "${env.PR_NUMBER ?? ""}" (empty on non-PR events).`);
  }
  const body = commentBody(totals);
  const comments = await githubList(`/issues/${env.PR_NUMBER}/comments`);
  const existing = comments.toReversed().find((c) => typeof c.body === "string" && c.body.includes(MARKER));

  if (existing) {
    const updated = await githubRequest("PATCH", `/issues/comments/${existing.id}`, { body });
    console.log(`Updated comment: ${updated.html_url}`);
  } else {
    const created = await github(`/issues/${env.PR_NUMBER}/comments`, { body });
    console.log(`Created comment: ${created.html_url}`);
  }
}

/** % of the `lines` column in the last data row, or null (fresh/empty CSV). */
function previousLinesPct(dataRows) {
  const prev = dataRows.at(-1)?.split(",")[2];
  const value = Number(prev);
  return prev !== undefined && Number.isFinite(value) ? { raw: prev, value } : null;
}

function logCsvRow(totals) {
  mkdirSync(dirname(csvPath), { recursive: true });
  if (!existsSync(csvPath)) writeFileSync(csvPath, `${CSV_HEADER}\n`);

  // Mirror the old `grep -q ",$GITHUB_SHA,"` idempotency check: two workflows
  // (or a re-run) recording the same commit must not duplicate the row.
  const dataRows = readFileSync(csvPath, "utf8").split(/\r?\n/).slice(1).filter((line) => line.trim());
  if (dataRows.some((line) => line.includes(`,${sha},`))) {
    console.log(`::notice::Commit ${sha7} is already recorded; nothing to do.`);
    return;
  }

  const currentLines = totals.lines;
  let regression = "";
  const prev = previousLinesPct(dataRows);
  if (prev) {
    const drop = Number((prev.value - currentLines).toFixed(2));
    if (drop > ALERT_DROP_PP) {
      regression = `**ALERT: dropped ${drop.toFixed(2)} pp vs previous commit (> 5 pp threshold)**`;
      console.log(
        `::warning::Lines coverage dropped ${drop.toFixed(2)} pp (${prev.raw}% -> ${currentLines}%) — investigate per analysis.md.`,
      );
    }
  }

  const row = buildCsvRow(totals, new Date().toISOString().slice(0, 10), sha).trimEnd();
  appendFileSync(csvPath, `${row}\n`);
  // Hand the exact row to the push step so it can re-append after a re-sync.
  if (env.GITHUB_ENV) appendFileSync(env.GITHUB_ENV, `ROW=${row}\n`);

  appendStepSummary(
    [
      renderMarkdown(totals, `Coverage — ${sha7}`).trimEnd(),
      "",
      ...(regression ? [regression, ""] : []),
      `Logged in \`${csvLabel}\` as \`${row}\``,
      "",
    ].join("\n"),
  );
  console.log(`Recorded: ${row}`);
}

if (!wantCsvLog && !wantComment) {
  console.log("::notice::Nothing to do: set PR_NUMBER for the PR comment and/or LOG_CSV=1 for the CSV row.");
} else {
  try {
    if (!sha) throw new Error("GITHUB_SHA is not set; the workflows provide it automatically.");
    const totals = readTotals();
    if (wantCsvLog) logCsvRow(totals);
    if (wantComment) await upsertPrComment(totals);
  } catch (err) {
    console.log(`::error::${err.message}`);
    process.exit(1);
  }
}
