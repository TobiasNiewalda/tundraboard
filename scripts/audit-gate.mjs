import { spawnSync } from "node:child_process";

const allowedPrismaChain = {
  prisma: {
    severity: "high",
    range: "6.13.0-dev.1 - 8.1.0-dev.4",
    via: "@prisma/config",
  },
  "@prisma/config": {
    severity: "high",
    range: "6.13.0-dev.1 - 8.1.0-dev.4",
    via: "deepmerge-ts",
  },
  "deepmerge-ts": {
    severity: "high",
    range: "<8.0.0",
    title: "DeepmergeTS has stack exhaustion when merging recursive object graphs",
  },
};
const allowlistExpiresAt = new Date("2026-12-31T23:59:59.000Z");
const now = new Date();

const result =
  process.platform === "win32"
    ? spawnSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "npm audit --json"], {
        encoding: "utf8",
      })
    : spawnSync("npm", ["audit", "--json"], {
        encoding: "utf8",
      });

const output = (result.stdout || result.stderr || "").trim();

if (!output) {
  console.error("npm audit did not return any output.");
  process.exit(1);
}

let report;
try {
  report = JSON.parse(output);
} catch (error) {
  console.error("Failed to parse npm audit JSON output.");
  console.error(output);
  process.exit(1);
}

if (report.error) {
  console.error("npm audit returned an error payload.");
  console.error(JSON.stringify(report.error, null, 2));
  process.exit(1);
}

const vulnerabilities = report.vulnerabilities ?? {};
const names = Object.keys(vulnerabilities);
if (result.status !== 0 && names.length === 0) {
  console.error("npm audit exited with an error before returning vulnerabilities.");
  process.exit(1);
}

const unexpected = names.filter((name) => {
  const entry = vulnerabilities[name];
  const allowed = allowedPrismaChain[name];

  if (!allowed) {
    return true;
  }

  if (entry.severity !== allowed.severity || entry.range !== allowed.range) {
    return true;
  }

  if (name === "deepmerge-ts") {
    return !entry.via?.some((item) => item?.title === allowed.title);
  }

  return !entry.via?.includes(allowed.via);
});

if (unexpected.length > 0) {
  console.error("Blocking npm audit vulnerabilities found:");
  for (const name of unexpected) {
    const entry = vulnerabilities[name];
    console.error(`- ${name} (${entry.severity})`);
  }
  process.exit(1);
}

if (names.length > 0) {
  if (now > allowlistExpiresAt) {
    console.error(`The temporary Prisma allowlist expired on ${allowlistExpiresAt.toISOString()}.`);
    console.error("Please upgrade Prisma to a fixed stable version.");
    process.exit(1);
  }

  console.warn("Allowing the known Prisma advisory chain temporarily:", names.join(", "));
  console.warn(`Allowlist expires on ${allowlistExpiresAt.toISOString()}.`);
}
