// AI security scan: reads diff.txt, writes a job summary + annotations, exits 1 on CRITICAL findings.
// Any AI failure (outage, bad JSON) exits 2 so the workflow can fail open.
// Known false positives are suppressed via allowlist.json (loaded from the BASE branch by the
// workflow, so a PR cannot allowlist its own findings).
import { appendFileSync, readFileSync } from "node:fs";
import { askChunks, readDiff, INJECTION_GUARD } from "./lib/ai-client.mjs";

const SYSTEM = `You are an application security engineer auditing a pull request diff for TundraBoard
(Node, Express, Prisma, JWT auth). Check for OWASP Top 10 issues in the changed code: injection,
broken access control, authentication/JWT flaws, hardcoded secrets, unsafe deserialisation, SSRF,
missing input validation, sensitive data exposure, insecure dependencies or config.
Rate "critical" only for directly exploitable issues (e.g. auth bypass, injection, committed secrets).
Do not report speculative issues or style problems.
${INJECTION_GUARD}
Schema: {"findings": [{"file": string, "line": number, "severity": "critical"|"high"|"medium"|"low",
"title": string, "explanation": string, "fix": string}]}`;

const SEVERITIES = ["critical", "high", "medium", "low"];

function loadAllowlist() {
  try {
    const list = JSON.parse(readFileSync("allowlist.json", "utf8"));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

let all = [];
let skipped = [];
let failed = 0;
try {
  const diff = readDiff();
  if (diff.trim()) {
    const r = await askChunks(SYSTEM, diff);
    all = r.results.flatMap((x) => (Array.isArray(x.findings) ? x.findings : []));
    ({ skipped, failed } = r);
  }
} catch (err) {
  console.error(`Scan failed: ${err.message}`);
  process.exit(2);
}

all = all
  .filter((f) => f && typeof f.file === "string")
  .map((f) => ({
    ...f,
    severity: SEVERITIES.includes(f.severity) ? f.severity : "medium",
    title: String(f.title ?? "Untitled finding"),
    explanation: String(f.explanation ?? ""),
    fix: String(f.fix ?? ""),
  }));

const allowlist = loadAllowlist();
const isAllowed = (f) =>
  allowlist.some(
    (a) => a.file === f.file && f.title.toLowerCase().includes(String(a.title).toLowerCase()),
  );
const suppressed = all.filter(isAllowed);
const findings = all.filter((f) => !isAllowed(f));
const critical = findings.filter((f) => f.severity === "critical");

const rows = findings.map(
  (f) => `| ${f.severity} | \`${f.file}:${f.line}\` | ${f.title} | ${f.fix} |`,
);
let summary = findings.length
  ? `## AI security scan\n\n| Severity | Location | Issue | Suggested fix |\n|---|---|---|---|\n${rows.join("\n")}\n`
  : "## AI security scan\n\nNo security findings.\n";
if (suppressed.length) {
  summary += `\n**Suppressed by allowlist (${suppressed.length}):** ${suppressed
    .map((f) => `\`${f.file}\` ${f.title}`)
    .join("; ")}\n`;
}
if (skipped.length || failed) {
  summary +=
    `\n> ⚠️ **Incomplete scan.** ` +
    (skipped.length ? `Not scanned (too large / over size cap): ${skipped.join(", ")}. ` : "") +
    (failed ? `${failed} part(s) failed due to AI errors. ` : "") +
    `Review these manually before merging.\n`;
  console.log("::warning title=Incomplete AI security scan::Some changed files were not scanned.");
}

if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
console.log(summary);

for (const f of findings) {
  const level = f.severity === "critical" || f.severity === "high" ? "error" : "warning";
  console.log(`::${level} file=${f.file},line=${f.line},title=${f.title}::${f.explanation}`);
}

if (critical.length) {
  console.error(`::error::${critical.length} critical security finding(s) detected. Merge blocked.`);
  process.exit(1);
}
