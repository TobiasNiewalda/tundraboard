import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const gitBashCandidates = [
  "C:/Program Files/Git/bin/bash.exe",
  "C:/Program Files/Git/usr/bin/bash.exe",
];

function findGitBash() {
  for (const candidate of gitBashCandidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

const shell = process.platform === "win32" ? (findGitBash() ?? "bash") : "bash";

const result = spawnSync(shell, ["scripts/pre-commit.sh"], {
  stdio: "inherit",
  cwd: process.cwd(),
  env: process.env,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
