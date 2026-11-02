# AI Development Standards — TundraBoard Team (V2.1)

This document outlines the shared expectations and guardrails for using AI assistants within the TundraBoard project. Our goal is to maximize productivity while ensuring security, consistency, and architectural integrity.

## 1. Approved Tools
To prevent "tool sprawl" and ensure a consistent developer experience, we utilize a specific three-slot strategy. Using tools outside this list is discouraged as they may not meet our security or indexing requirements.

| Slot | Tool | Tier | Configuration / Permissions |
| :--- | :--- | :--- | :--- |
| **IDE Assistant** | Cursor | Business | Latest stable; Indexing enabled for Prisma schemas and Express routes. |
| **Terminal Agent** | Claude Code | Pro/Enterprise | Balanced permissions: `auto-read` enabled; `ask-for-write` required. |
| **Reasoning Workspace**| Claude / ChatGPT | Enterprise | Enterprise accounts only; "Training on my data" disabled. |
| **Local sandbox** | Ollama / Local LLM | N/A | **Air-gapped/Local only.** No external network access. Used for initial "de-fusing" or debugging highly sensitive logic. |

**Model Defaults & Reasoning Budget:**
- **Generation Models** (Fast): Default for IDE autocomplete, routine CRUD, and deterministic transformations.
- **Reasoning Models** (Extended Thinking): Required for complex PostgreSQL query optimization, multi-file refactors, and security reviews.
- **Usage Guidelines:** While we monitor costs, developers are encouraged to use reasoning models as needed to ensure code quality. If you encounter unexpected token limits, contact the team lead for a quota increase rather than switching to non-approved tools.

## 2. Data Handling
TundraBoard handles sensitive project and user data. We prioritize "Zero-Leak" prompting over manual abstraction.

### Data Classification & Prompting Rules
- **Restricted (NEVER Prompt):** API keys, production passwords, private SSH keys, and encryption secrets.
- **Confidential (Enterprise Only):** Customer PII (emails, phone numbers), detailed client contracts. Must only be used with Enterprise-tier tools where data is not used for training.
- **Internal (Review First):** Proprietary business logic, internal infrastructure maps, unreleased feature specs.
- **Public (Safe):** Open-source libraries, general language patterns, public documentation.

### The "Never Prompt" List
The following are strictly forbidden in any AI prompt:
- `.env` files, raw secrets, or JWT signing keys.
- Production PostgreSQL database dumps.
- Actual TundraBoard user email addresses or PII.
- Internal server IP addresses or hostnames.

### Abstraction & Context Management
While we discourage tedious manual masking (e.g., replacing every ID), we require a **Minimal Viable Context** approach to protect IP:
- **Targeted Snippets:** Provide the target block and necessary TypeScript interfaces/signatures rather than the whole file.
- **Context Reset:** Start a new conversation for sensitive material instead of accumulating context across turns to prevent "leakage" into unrelated prompts.

## 3. Prompt Library
To avoid "prompt lottery" (where results vary wildly by dev), we centralize high-performing templates.

- **Location:** `/docs/ai/prompts/` (Organized by: `code-generation/`, `testing/`, `review/`, and `documentation/`).
- **Contribution:** If a prompt consistently produces high-quality results, submit it via PR to the prompts directory.
- **Review Cadence:** Prompt templates are reviewed during monthly technical syncs to prune obsolete patterns.

## 4. Code Review & Verification
AI-generated code is subject to the same quality bar as human-written code. **The author owns the code, regardless of the tool used to generate it.**

### The Verification Pipeline (Fail-Fast)
Before submitting a PR, AI-generated code must pass:
1. **Type Check:** `npx tsc --noEmit`
2. **Lint:** `npx eslint src/ --max-warnings 0`
3. **Format:** `npx prettier --check src/`
4. **Tests:** `npx vitest run`
5. **Security Scan:** `npm audit --audit-level=high`

### Review Requirements & Disclosure
- **Disclosure:** We do **not** require `[AI-Generated]` tags in PRs, as the origin is less important than the outcome. The focus is on ownership and verification.
- **AI-Specific Review Heuristics:** Reviewers must actively hunt for:
    - **Hallucinations:** Non-existent library methods or API calls.
    - **Logic Leakage:** Over-simplified business rules or missed edge cases.
    - **Concurrency:** Race conditions in asynchronous flows or Prisma transactions.
    - **Dependency Vetting:** Any new dependency suggested by AI must undergo a **Dependency Validation Check** before merge.

- **Extra Scrutiny Areas:** Manual verification is mandatory for:
    - JWT authentication and role-based authorization.
    - Prisma schema changes and PostgreSQL migrations.
    - Performance-critical PostgreSQL queries.

## 5. Managing AI Technical Debt
To prevent a fragmented "AI-style" codebase:
- **Architectural Alignment:** AI-generated refactors must adhere to existing project patterns. "Technically correct" but architecturally inconsistent code is considered debt.
- **AI Debt Pruning:** Sections introducing "AI-bloat" (excessive boilerplate) are marked as `AI-Debt` during review. One session per quarter is dedicated to pruning this debt.

## 6. Onboarding
New team members must complete this setup on Day 1:
1. **Tool Setup:** Install Cursor (Business account) and Claude Code (configure permissions).
2. **Configuration:** Verify that "Data Training" is disabled in all reasoning workspace settings.
3. **Verification Task:** Use a shared template from `/docs/ai/prompts/` to generate a unit test for a utility function.
4. **Support:** Contact the Lead Architect or Security Officer for guidance.

## 7. Incident Response
In the event of an AI-related security or quality failure, the team must follow these protocols.

### Data Leak Response (Accidental Prompting)
If sensitive data (secrets, PII, internal hostnames) is accidentally sent to an AI tool:
1. **Immediate Notification:** Notify the Lead Architect and Security Officer immediately. Do not wait to "see if it's a problem."
2. **Credential Rotation:** If any secret (API key, JWT secret, DB password) was leaked, rotate it immediately across all environments.
3. **Exposure Assessment:** Identify exactly what was leaked and which tool was used. If a personal-tier tool was used, treat the data as publicly exposed.
4. **Containment:** If the tool allows for conversation deletion or "forgetting" data, execute those actions immediately.
5. **Retrospective:** Conduct a post-mortem to update the "Never Prompt" list or Onboarding guide as needed.

### AI-Generated Bug Response
If a production bug is traced back to AI-generated code:
1. **Root Cause Analysis:** Determine if the bug was a result of a "hallucination," a misunderstanding of the codebase, or a failure in the human review process.
2. **Verification Gap Analysis:** Identify which stage of the Verification Pipeline failed to catch the bug.
3. **Standard Update:** Update the "Extra Scrutiny Areas" list or add a new prompt template to the library to prevent the specific pattern from recurring.

## 8. Review Cadence
These standards are living documents and are updated:
- **Quarterly:** Scheduled review of tools, tiers, and prompt library effectiveness.
- **Event-Driven:** Immediately following any security incident, production bug caused by AI code, or major tool version release.