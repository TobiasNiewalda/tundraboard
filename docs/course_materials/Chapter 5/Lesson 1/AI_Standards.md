# AI Development Standards — TundraBoard Team

This document outlines the shared expectations and guardrails for using AI assistants within the TundraBoard project. Our goal is to maximize productivity while ensuring security, consistency, and code quality.

## Approved Tools
We use a "three-slot" tool strategy tailored for our **TypeScript/Express/Prisma** stack.

| Slot | Tool | Tier | Configuration / Permissions |
| :--- | :--- | :--- | :--- |
| **IDE Assistant** | Cursor | Business | Latest stable; Indexing enabled for Prisma schemas and Express routes. |
| **Terminal Agent** | Claude Code | Pro/Enterprise | Balanced permissions: `auto-read` enabled; `ask-for-write` required. |
| **Reasoning Workspace**| Claude / ChatGPT | Enterprise | Enterprise accounts only; "Training on my data" disabled. |

**Model Defaults & Reasoning Budget:**
- **Generation Models** (Fast): Default for IDE autocomplete, routine CRUD (e.g., simple Task/Workspace API endpoints), and deterministic transformations.
- **Reasoning Models** (Extended Thinking): Use for complex PostgreSQL query optimization, multi-file refactors, security reviews, and novel algorithm design.
- **Budget Constraints:** 
    - Extended thinking is capped at 4K tokens per prompt. 
    - Limit of 10 extended-thinking prompts per developer/day.
    - Terminal agent runs are limited to 10 tool hops and 2K reasoning tokens per hop. 
    - Exceeding these limits requires team-lead approval.

## Data Handling
TundraBoard handles sensitive project and user data. All team members must adhere to these classification rules.

### Data Classification & Prompting Rules
- **Restricted (NEVER Prompt):** API keys, production passwords, private SSH keys, and encryption secrets.
- **Confidential (Enterprise Only):** Customer PII (emails, phone numbers), detailed client contracts. Must only be used with Enterprise-tier tools where data is not used for training.
- **Internal (Review First):** Proprietary business logic, internal infrastructure maps, unreleased feature specs. Use abstraction (see below).
- **Public (Safe):** Open-source libraries, general language patterns, public documentation.

### The "Never Prompt" List
Do **not** paste the following into any AI tool:
- `.env` files, raw secrets, or JWT signing keys.
- Production PostgreSQL database dumps.
- Actual TundraBoard user email addresses or PII.
- Internal server IP addresses or hostnames.

### Abstraction & Context Management
When prompting with internal code, use a "minimal viable context" approach to protect TundraBoard's intellectual property:
- **Smallest Possible Set:** Start with the smallest context that explains the target and its direct dependencies. Only add more code when reasoning about cross-file contracts (e.g., interaction between a Route handler and a Prisma Service) is required.
- **Abstraction:** Replace sensitive identifiers with generic placeholders (e.g., `workspace_id_abc123` $\rightarrow$ `[WORKSPACE_ID]`, `user_email@example.com` $\rightarrow$ `[USER_EMAIL]`).
- **Targeted Snippets:** For single function changes, include the target block, required TypeScript interfaces/signatures, and one style example rather than the whole file.
- **Context Reset:** Start a new conversation for sensitive material instead of accumulating context across turns.

## Prompt Library
To maintain consistency, we share high-performing prompt templates.

- **Location:** `/docs/ai/prompts/` (Version controlled within the repo, organized by task family: `code-generation/`, `testing/`, `review/`, and `documentation/`).
- **Contribution:** If you develop a prompt that consistently produces high-quality results for a recurring task, submit it via PR to the prompts directory.
- **Review Cadence:** Prompt templates are reviewed during monthly technical syncs to prune obsolete patterns and promote successful ones.

## Code Review & Verification
AI-generated code is subject to the same quality bar as human-written code.

### The Verification Pipeline
Before submitting a PR, all AI-generated code must pass the following pipeline (Fail-Fast approach):
1. **Type Check:** `npx tsc --noEmit` (Fix type errors first).
2. **Lint:** `npx eslint src/ --max-warnings 0` (Zero-warning policy).
3. **Format:** `npx prettier --check src/`.
4. **Tests:** `npx vitest run` (Verify functional correctness).
5. **Security Scan:** `npm audit --audit-level=high`.

### Review Requirements
- **Human-in-the-Loop:** All AI-generated code must be reviewed by a human. The author is responsible for the correctness of the AI output.
- **Disclosure:** Tag AI-generated sections in GitHub PR descriptions (e.g., `[AI-Generated: Vitest Suite for Workspace API]`).
- **Extra Scrutiny Areas:** Manual verification is mandatory for:
    - JWT authentication and role-based authorization logic.
    - Prisma schema changes and PostgreSQL migrations.
    - Critical data handling (e.g., Task/User PII processing).
    - Performance-critical PostgreSQL queries and loops.

### Automated AI Review
We use GitHub Actions for auxiliary AI review:
- **AI Code Review:** Provides advisory comments on correctness and style. These are non-blocking.
- **AI Security Scan:** Checks for OWASP Top 10 issues. **Critical findings block the merge** unless a maintainer applies the `security-override` label or adds the finding to `.github/ai-security-allowlist.json`.

## Onboarding
New team members should complete this setup on their first day:

1. **Tool Setup:**
    - Install Cursor and sign in with the team Business account.
    - Install Claude Code and configure permissions as per the "Approved Tools" table.
2. **Configuration:** 
    - Ensure "Data Training" is disabled in all reasoning workspace settings.
3. **Verification Task:** 
    - Open the `/docs/ai/prompts/` directory and use one of the shared templates to generate a simple unit test for a utility function in the project.
4. **Support:** If you have questions, contact the Lead Architect or the Security Officer.

## Incident Response
In the event of an AI-related security or quality failure, the team must follow these protocols.

### Data Leak Response (Accidental Prompting)
If sensitive data (secrets, PII, internal hostnames) is accidentally sent to an AI tool:
1. **Immediate Notification:** Notify the Lead Architect and Security Officer immediately. Do not wait to "see if it's a problem."
2. **Credential Rotation:** If any secret (API key, JWT secret, DB password) was leaked, rotate it immediately across all environments.
3. **Exposure Assessment:** Identify exactly what was leaked and which tool was used. If a personal-tier tool was used, treat the data as publicly exposed.
4. **Containment:** If the tool allows for conversation deletion or "forgetting" data, execute those actions immediately, though acknowledge this does not guarantee data removal from provider logs.
5. **Retrospective:** Conduct a post-mortem to determine if the leak was due to a lack of abstraction or a tool misconfiguration. Update the "Never Prompt" list or Onboarding guide as needed.

### AI-Generated Bug Response
If a production bug is traced back to AI-generated code:
1. **Root Cause Analysis:** Determine if the bug was a result of a "hallucination," a misunderstanding of the codebase, or a failure in the human review process.
2. **Verification Gap Analysis:** Identify which stage of the Verification Pipeline (Type check, Lint, Test) failed to catch the bug.
3. **Standard Update:** Update the "Extra Scrutiny Areas" list or add a new prompt template to the library to prevent the specific pattern from recurring.

## Review Cadence
These standards are living documents and will be updated:
- **Quarterly:** Scheduled review of tools, tiers, and prompt library effectiveness.
- **Event-Driven:** Immediately following any security incident, production bug caused by AI code, or major tool version release.
