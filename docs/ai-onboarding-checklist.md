# AI Onboarding Checklist — TundraBoard (First Week)

> **Purpose:** Every new developer must complete this checklist in their first week to be compliant with the TundraBoard AI Governance Framework (AI Development Standards V2.1, IP & Accountability Policy, AI Risk Assessment).
>
> **Contacts:** Lead Architect — technical questions & quota increases · Security Officer — anything sensitive or incident-related.

---

## Day 1 — Tool Setup & Account Tiers

Use only the approved three-slot tool strategy. Do **not** install other AI tools without approval (no tool sprawl).

- [ ] **IDE Assistant — Cursor** *(Business tier)* installed and signed in with your company account.
  - Latest stable version; indexing enabled for Prisma schemas and Express routes.
- [ ] **Terminal Agent — Claude Code** *(Pro/Enterprise tier)* installed.
  - Configure permissions: `auto-read` enabled, **`ask-for-write` required** (never allow auto-write).
- [ ] **Reasoning Workspace — Claude / ChatGPT** *(Enterprise accounts only)*.
  - Verify **"Training on my data" is disabled** in all workspace settings. Screenshot/check this — it is a hard requirement.
- [ ] *(Optional, advanced)* **Local sandbox — Ollama / local LLM**: air-gapped/local only, no external network access. For de-fusing or debugging highly sensitive logic.
- [ ] Know the model defaults: fast/generation models for routine CRUD & autocomplete; **reasoning models required** for Postgres query optimization, multi-file refactors, and security reviews. If you hit token limits, ask the Lead Architect for a quota increase — never switch to a non-approved tool.

## Day 1–2 — Mandatory Reading

Read all three documents and be ready to answer questions about them during your check-in:

- [ ] **AI Development Standards V2.1** — `docs/course_materials/Chapter 5/Lesson 1/AI_Standards_V2.md`
  - Focus on: approved tools & tiers, data classification, the **"Never Prompt" list**, the Verification Pipeline.
- [ ] **AI IP & Accountability Policy** — `docs/course_materials/Chapter 5/Lesson 3/IP_Policy.md`
  - Focus on: the Commander Principle (§2.1), disclosure rules, prohibited inputs.
- [ ] **AI Risk Assessment** — `docs/course_materials/Chapter 5/Lesson 3/AI_Risk_Assessment.md`
  - Focus on: EU AI Act risk tiers, the HR firewall on AI review data, and re-classification triggers.
- [ ] Skim the **AI Tool Inventory** and the prompt library (see below) so you know what's already approved.

### Key rules you must be able to recite by Day 3

- **Never prompt:** `.env` files, raw secrets/JWT keys, production DB dumps, real user PII, internal server IPs/hostnames.
- **Minimal Viable Context:** share targeted snippets + TypeScript signatures, not whole files; start a fresh conversation for sensitive material.
- **Verification Pipeline (before any PR):** `tsc --noEmit` → `eslint --max-warnings 0` → `prettier --check` → `vitest run` → `npm audit --audit-level=high`.

## Day 2–3 — Commander Principle Sign-Off

> **The Commander Principle (IP Policy §2.1):** AI agents are tools, not authors. The human developer — the Commander — is **100% accountable for every line committed**, whether handwritten or AI-generated. There is no such thing as an "AI-generated bug." AI code must meet the same quality, security, and architectural bar as human code.

- [ ] I have read and understood the Commander Principle.
- [ ] I understand that "the AI wrote it" is never an acceptable explanation in a review, incident, or post-mortem.
- [ ] I understand the extra-scrutiny areas requiring manual verification: **JWT auth / RBAC, Prisma schema changes & migrations, performance-critical Postgres queries**.
- [ ] I understand AI-suggested **new dependencies** require a Dependency Validation Check before merge.
- [ ] I understand autonomous/auto-merge agent work requires explicit PR-level disclosure and a traceable audit trail.

**Sign-off:**

| Field | Value |
| :--- | :--- |
| Name | ______________________ |
| Role / Team | ______________________ |
| Signature | ______________________ |
| Date | ______________________ |
| Witness (Lead Architect or Security Officer) | ______________________ |

## Day 3–4 — Verification Task (Hands-On)

Complete this practical task to prove you can use AI within our guardrails:

- [ ] Pick a small, real utility function in `src/` (ask your onboarding buddy for a suggestion).
- [ ] Use a shared template from the prompt library (`promts/` — e.g. `generate_test_based_on_requirement.md` or `template.md`) to have your AI assistant generate a **unit test** for it.
- [ ] Do it properly:
  - [ ] Prompt used **Minimal Viable Context** (no whole files pasted, no sensitive data).
  - [ ] You **reviewed the generated test** for hallucinated APIs, missed edge cases, and logic leakage.
  - [ ] The test passes the local pipeline: `npx vitest run` (plus lint/format on touched files).
- [ ] Commit the test via a normal PR and note in the PR description which prompt template you used (good practice for your first weeks; standard disclosure rules otherwise apply).
- [ ] Submit the task for review by your Lead Architect. This also counts as your **Art. 4 AI-literacy training record** per the Risk Assessment.

## Day 5 — Incident Response Briefing

Know exactly what to do — **before** you ever need it:

- [ ] **Who to report to:** the **Lead Architect** and the **Security Officer** — immediately, via direct message (do not wait to "see if it's a problem").
- [ ] **Data leak (sensitive data accidentally prompted):** report immediately → if a secret was leaked, **rotate credentials across all environments** → identify what was leaked and which tool was used (personal-tier tool = treat as publicly exposed) → use the tool's delete/"forget" functions → post-mortem follows.
- [ ] **AI-generated bug reaching production:** escalate for root-cause analysis and verification-gap analysis; the affected "Extra Scrutiny Area" or prompt template gets updated.
- [ ] **Secret/token detected in CI:** the key is considered compromised — immediate rotation, and the commit is scrubbed from history.
- [ ] I know where the incident protocols live: AI Standards V2.1, §7 (`docs/course_materials/Chapter 5/Lesson 1/AI_Standards_V2.md`).

---

## Final Week-1 Check

- [ ] All four sections above complete and signed off.
- [ ] Onboarding buddy / Lead Architect has countersigned the Commander sign-off.
- [ ] Completed checklist filed with the Lead Architect as the team's AI-literacy training record (per AI Risk Assessment, Dev Assistance row).

**Governance note:** The AI Governance documents are living documents — reviewed quarterly and event-driven after incidents. If any rule here conflicts with the IP Policy, the IP Policy takes precedence. When in doubt, ask before you prompt.
