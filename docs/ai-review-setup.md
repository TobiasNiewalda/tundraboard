# AI PR Review: Permissions and Secrets

Applies to `.github/workflows/ai-review.yml`.

## 1. Actions permissions

The workflow sets `permissions: {}` at the top level, so every job starts with no access, and each job then grants itself only what it needs.

| Job | Permission | Why |
|---|---|---|
| `ai-review` | `contents: read` | Check out the code and compute the PR diff. |
| `ai-review` | `pull-requests: write` | Post the review and its inline comments (`POST /pulls/{n}/reviews`) and the "review unavailable" note (`POST /issues/{n}/comments`). |
| `security-scan` | `contents: read` | Check out the code and compute the diff. Nothing else: it reports through the job summary, annotations and exit code. |
| `security-gate` | none | It only inspects the result of `security-scan`. |

Deliberately **not** granted: `contents: write` (the agent cannot push), `issues`, `actions`, `checks`, `statuses`, `id-token`, `packages`. The review is posted with event `COMMENT`, so the bot can never approve, request changes or merge. If `contents: write` were granted by mistake, a prompt-injected diff could trick the agent into pushing to branches, so keep it read-only.

Also: `actions/checkout` runs with `persist-credentials: false`, so the token is not left in `.git/config` for later steps.

### Repository setting to check

Settings → Actions → General → **Workflow permissions**. Either option works, because the `permissions:` block in the workflow overrides the default.
- Keep **Read repository contents and packages permissions** (recommended).
- You do **not** need to tick "Allow GitHub Actions to create and approve pull requests". That is only for approving reviews, which the bot must never do.

If the organization restricts workflow permissions to read-only at the org level, the `pull-requests: write` request will be capped. In that case the review step cannot post comments, and it will warn and skip.

## 2. Secrets and variables

| Name | Kind | Where it comes from | Used by |
|---|---|---|---|
| `AI_API_KEY` | Secret | OpenRouter dashboard → Keys. Set a spending limit on the key. | both jobs |
| `AI_BASE_URL` | Variable | e.g. `https://openrouter.ai/api/v1` | both jobs |
| `AI_MODEL` | Variable | An OpenRouter model slug, e.g. `anthropic/claude-sonnet-4.5` | both jobs |
| `GITHUB_TOKEN` | Automatic | Created by GitHub for every workflow run | `ai-review` only |

### GitHub token: nothing to set up
`GITHUB_TOKEN` is generated automatically for each run, expires when the job ends, and is scoped to the `permissions:` block above. Do **not** create a personal access token and do **not** store one as a secret. The workflow passes it only to the review step (`GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}`). The security scan never receives it.

### Setting up the AI key and variables
Repository → **Settings → Secrets and variables → Actions**.
1. **Secrets** tab → **New repository secret** → name `AI_API_KEY`, paste the OpenRouter key.
2. **Variables** tab → **New repository variable** → `AI_BASE_URL` and `AI_MODEL`.

CLI alternative:
```
gh secret set AI_API_KEY
gh variable set AI_BASE_URL --body "https://openrouter.ai/api/v1"
gh variable set AI_MODEL --body "anthropic/claude-sonnet-4.5"
```

Use **Actions** secrets, not the separate "Agents" secrets, which are only visible to Copilot cloud agent and not to workflows.

### Branch protection (required for the merge block)
Settings → Branches → rule for `main` → **Require status checks to pass** → add **Security Gate**. Without this, a failing scan is only a red mark and does not block the merge.

### Optional
- Create the label `security-override` and limit who can apply it (it bypasses the gate for a false positive).
- Rotate `AI_API_KEY` quarterly and review which workflows use it.
- Fork PRs get no secrets, so the AI jobs are skipped for them.

## 3. Edge cases

### AI API unavailable
- Each call has a 60s timeout and up to 3 attempts with backoff. 429 honours `Retry-After`.
- **Review:** warns, leaves a "review unavailable" note on the PR, never fails the job.
- **Security scan:** fails **open**. It warns and the gate passes, because an outage must not block all merges. Nothing is posted on the PR, so check the job log. The `auth` and `config` errors also fail open, so verify the first run.

### Very large diffs (>10,000 lines)
- The diff is split per file into chunks of about 60k characters, riskiest first (`src/`, then `prisma`/`scripts`/`.github`, then other, then `tests/` and `docs/`).
- At most 4 chunks (about 6,000 lines) are sent per run, to cap cost and latency. Files that don't fit, and single files larger than a chunk, are **skipped and listed**.
- Skipped or failed parts show up as a "Partial review" note on the PR review and an "Incomplete scan" note plus warning in the scan summary. The gate does **not** block on incomplete coverage, so a human must check the listed files.
- The lockfile, snapshots and `docs/` are already excluded from the diff.

### Dismissing a false positive
1. **AI review comments** are advisory: reply and resolve the conversation. They never block.
2. **One finding, permanently:** add an entry to `.github/ai-security-allowlist.json` in a **separate PR**:
   ```json
   [{ "file": "src/routes/auth.ts", "title": "hardcoded", "reason": "test fixture, not a real secret" }]
   ```
   `title` is a case-insensitive substring of the finding title. The file is read from the base branch, so a PR cannot allowlist its own findings. Suppressed findings are listed in the scan summary. Protect the file with CODEOWNERS.
3. **One PR, one-off:** a maintainer adds the `security-override` label, then clicks **Re-run failed jobs**. The gate reads labels live and passes with a warning. The scan job itself stays red, but only Security Gate is required.

## 4. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Warning "AI review skipped (config)" | `AI_BASE_URL`, `AI_MODEL` or `AI_API_KEY` is missing. |
| Warning "skipped (auth)" | Wrong or expired key. |
| Review step warns about a 403 or 404 from GitHub | Org policy caps the token to read-only, or the PR is from a fork. |
| "Scan unavailable" warning on every run | The scan fails open on AI errors, so the gate stays green. Fix the key, URL or model. |
