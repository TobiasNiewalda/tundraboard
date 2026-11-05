/**
 * coverage-summary.mjs — read the totals out of Vitest's json-summary report.
 *
 * The CI pipeline runs `npm run test:coverage`, which writes
 * coverage/coverage-summary.json. This module turns the `total` block into
 * the pieces the workflows need, without any new dependencies. The functions
 * are exported so scripts/metrics-coverage.mjs can reuse them; the CLI below
 * is what the workflows invoke directly:
 *
 *   node scripts/coverage-summary.mjs markdown [--heading "…"]
 *       → Markdown table of the four totals, with a `lines`-based headline
 *         percentage and a comparison against the analysis.md baseline (40%).
 *         Used for $GITHUB_STEP_SUMMARY and the PR comment body.
 *
 *   node scripts/coverage-summary.mjs csv-row <date> <commit>
 *       → one append-only row for metrics/coverage.csv:
 *         date,commit,lines,functions,branches,statements
 *
 *   node scripts/coverage-summary.mjs pct [lines|functions|branches|statements]
 *       → a single percentage number (default: lines) for shell arithmetic
 *         and regression checks.
 *
 * Exit codes: 0 success, 1 missing/invalid summary file or bad arguments.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SUMMARY_FILE = resolve("coverage", "coverage-summary.json");
export const METRICS = ["lines", "functions", "branches", "statements"];
// Chapter 5 Lesson 2 baseline: current vs 40%.
const BASELINE_PCT = 40;

/** Totals as { lines, functions, branches, statements } → percentages. Throws if unusable. */
export function readTotals() {
  let summary;
  try {
    summary = JSON.parse(readFileSync(SUMMARY_FILE, "utf8"));
  } catch {
    throw new Error(
      `could not read ${SUMMARY_FILE}. Run "npm run test:coverage" first ` +
        "(the json-summary reporter must stay enabled in vitest.config.ts).",
    );
  }
  const total = summary.total;
  if (
    !total ||
    !METRICS.every((m) => total[m] && Number.isFinite(total[m].pct))
  ) {
    throw new Error(`no usable "total" block in ${SUMMARY_FILE}.`);
  }
  return Object.fromEntries(METRICS.map((m) => [m, total[m].pct]));
}

/** Markdown table with a `lines`-based headline vs the baseline. Ends with a newline. */
export function renderMarkdown(totals, title = "Test coverage") {
  const lines = totals.lines;
  const delta = (lines - BASELINE_PCT).toFixed(2);
  const deltaLabel = lines >= BASELINE_PCT ? `+${delta}` : delta;
  return [
    `### ${title}`,
    "",
    `**Overall coverage (lines): ${lines.toFixed(2)}%** ` +
      `(vs 40% baseline: ${deltaLabel} pp)`,
    "",
    "| Lines | Functions | Branches | Statements |",
    "| --- | --- | --- | --- |",
    `| ${METRICS.map((m) => `${totals[m].toFixed(2)}%`).join(" | ")} |`,
    "",
  ].join("\n");
}

/** One append-only row for metrics/coverage.csv (header: date,commit,<metrics>). */
export function buildCsvRow(totals, date, commit) {
  return `${date},${commit},${METRICS.map((m) => totals[m].toFixed(2)).join(",")}\n`;
}

function fail(message) {
  console.error(`coverage-summary: ${message}`);
  process.exit(1);
}

/** CLI entry point; kept byte-compatible with the previous standalone script. */
function runCli() {
  const [command, ...args] = process.argv.slice(2);
  let totals;
  try {
    totals = readTotals();
  } catch (err) {
    fail(err.message);
  }

  switch (command) {
    case "markdown": {
      const i = args.indexOf("--heading");
      const title = i === -1 ? "Test coverage" : args[i + 1] || "Test coverage";
      process.stdout.write(renderMarkdown(totals, title));
      break;
    }

    case "csv-row": {
      const [date, commit] = args;
      if (!date || !commit) fail("usage: csv-row <date> <commit>");
      process.stdout.write(buildCsvRow(totals, date, commit));
      break;
    }

    case "pct": {
      const metric = args[0] || "lines";
      if (!METRICS.includes(metric))
        fail(`unknown metric "${metric}" (${METRICS.join("/")})`);
      process.stdout.write(`${totals[metric]}\n`);
      break;
    }

    default:
      fail(
        `unknown command "${command ?? ""}" (expected: markdown | csv-row | pct)`,
      );
  }
}

// Only run the CLI when invoked directly, not when imported by another script.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
