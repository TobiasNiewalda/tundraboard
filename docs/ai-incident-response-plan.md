# AI Incident Response Plan — TundraBoard

**Status:** Draft v1.0 · **Owner:** Engineering Lead + AI Governance Officer · **Review cadence:** quarterly, or after any AI incident

This plan covers incidents originating from our use of LLMs and autonomous agents (OpenCode, Cursor, Claude Code, CodeRabbit, etc. — see the [AI Tool Inventory](course_materials/Chapter%205/Lesson%203/AI%20inventory.md)). It complements, and does not replace, the general security incident response process.

---

## 1. Scope & Roles

| Role | Responsibility in an AI incident |
| :--- | :--- |
| **Incident Commander (IC)** | Runway for the response. Defaults to on-call engineering lead; may delegate. |
| **AI Governance Officer** | Owns re-classification decisions under the [AI Risk Assessment](course_materials/Chapter%205/Lesson%203/AI_Risk_Assessment.md), regulatory notification judgment, policy updates. |
| **Responder(s)** | Execute containment/remediation steps. Anyone may *start* an incident; only the IC declares severity. |
| **Comms/Management** | Customer, works council, and DPO communication. |

**Universal rules (all playbooks):**

1. **Declare early.** A false alarm costs 10 minutes; a late declaration costs days. Slack channel `#ai-incident` + issue tagged `ai-incident`.
2. **Preserve evidence.** Do not delete agent sessions, terminal logs, traces (Langfuse/Phoenix), or git state before the IC says so. Evidence list: OpenCode session logs, prompt history, `scripts/fetch_ai_usage.js` output, CI logs, container/VM snapshots.
3. **Assume propagation.** Anything an autonomous agent saw (files, env vars, database contents) must be treated as *copied off-host* until proven otherwise.
4. **Stop the source, not just the symptom.** Kill the agent run/gateway key before hunting symptoms.

**Severity matrix:**

| Sev | Definition | Examples |
| :--- | :--- | :--- |
| **S1** | Real-world harm likely or regulator/72h clock engaged | Production secret exfiltrated and provider cannot confirm deletion; Prohibited AI feature live in production |
| **S2** | Contained or internal-only, but requires coordinated response | PII pasted into prompt, confirmed not to reach training data; AI bug merged but caught before deploy |
| **S3** | Near-miss / policy violation without exposure | Secret in prompt caught by pre-commit scan; agent tried a prohibited action and was blocked |

---

## 2. Shared Detection Sources

- **Secret scanning:** `scripts/precommit.mjs` / `pre-commit.sh`, repo push protection, provider-side secret scanning.
- **AI audit gate:** `scripts/audit-gate.mjs` (policy checks on AI-assisted changes).
- **AI security scan & AI review:** `scripts/ai-security-scan.mjs`, `scripts/ai-review.mjs` (PR-level).
- **Agent observability:** Langfuse/Phoenix traces, OpenCode session logs, gateway (LiteLLM/OpenRouter) logs.
- **Human reports:** "🤖 AI Review" comments looking wrong, unexpected agent file edits, teammate reports in `#ai-incident`.

---

## 3. Playbook 1 — Data Leakage (secrets or PII in prompts)

**Typical scenarios:** An OpenCode agent reads a `.env` file and its contents end up in the model provider's logs; a developer pastes a production database dump or user record into a prompt; agent session logs containing PII get shared/screenshotted or shipped in a repo.

### 3.1 Detection
- Pre-commit secret scanner flags a secret in a file the agent touched or in a prompt artifact.
- Gateway/observability trace review (Langfuse) shows credential-shaped strings (`sk-`, `AKIA`, `-----BEGIN`, `postgres://user:pass@`) or PII-shaped fields (emails, IBANs, health data) in prompt payloads.
- Push protection or a secret-scanning alert on the remote repo.
- Human report: "I pasted the prod user table into the agent."

**Classify immediately:** *what* leaked (secret vs. personal data vs. customer code), *to whom* (which provider/aggregator — check the AI Tool Inventory for the DPA/training status of the model provider and any proxy like OpenRouter), and *how much* (one value vs. a dataset). PII of EU data subjects starts the GDPR clock (Art. 33: 72h assessment for reportable breaches).

### 3.2 Immediate Containment (target: < 30 min)
1. **Revoke first, investigate second.** Rotate every credential that appeared in a prompt or agent-visible file. Assume the secret is compromised even if the provider has "no training" terms — logs, caching, and moderation queues are still copies.
2. **Stop the flow.** Kill running agent sessions; disable the specific provider key or the gateway route (e.g., pause the OpenRouter/LiteLLM key) if the leak came from a provider whose DPA status is "TBD / Under Review" in the inventory.
3. **Cut secondary copies.** Remove the secret/PII from any pending PRs, session logs about to be committed, and shared screenshots/docs. If a dump file exists locally that the agent indexed, move it out of the workspace and exclude it from agent context (`.gitignore`, `.opencodeignore`).
4. **Snapshot evidence** (traces, session logs) *after* redaction, so cleanup doesn't destroy the record.

### 3.3 Remediation
1. **Verify scope:** search gateway and observability logs for every occurrence of the leaked value or data subject identifiers; determine retention windows per provider and request deletion where DPA terms allow (keep the confirmation).
2. **If PII of EU data subjects:** AI Governance Officer + DPO assess Art. 33/34 notification obligations (provider as processor, TundraBoard as controller). Document the decision either way.
3. **Clean the workspace:** rotate-and-purge pattern — new credentials, old values dead everywhere (env files, CI variables, cloud consoles, local shells).
4. **Fix the entry point:** e.g., add the file to agent context exclusions, tighten which directories OpenCode may read, enable secret redaction at the gateway layer.

### 3.4 Post-Mortem & Policy Update
- Blameless writeup in `docs/` within 5 working days: what leaked, provider path, containment timeline, residual risk.
- **Policy updates (as applicable):**
  - Add a "never in agent context" list to the workspace (`.env*`, dumps, HR files) and enforce via pre-commit + agent ignore rules.
  - Move any provider with DPA status "TBD" (DeepSeek, Qwen, GLM, OpenRouter per inventory) to approved-only list, or restrict to non-sensitive workloads until a DPA is signed.
  - Add a detection rule to `audit-gate.mjs` / `ai-security-scan.mjs` matching this leak class.
- Confirm the AI Literacy training ("Commander Principle": you are responsible for what you feed the model) is updated with this case as an example.

---

## 4. Playbook 2 — AI-Generated Bugs (security flaws / logic errors that bypassed verification)

**Typical scenarios:** An OpenCode-generated endpoint passes tests but misses an authorization check (IDOR); agent code introduces a subtle injection, race, or prototype-pollution bug; the AI review bot approves the same flawed pattern it generated; tests were co-generated by the same agent from the same (wrong) understanding.

### 4.1 Detection
- Post-merge security scan, pen-test report, or `ai-security-scan.mjs` finding on AI-touched code.
- Production anomaly: odd access patterns, unexpected 2xx/4xx mixes, data inconsistency, customer report.
- Human reviewer catching a flaw the AI review marked clean — treat AI-approved-but-human-suspect as a trigger, not a false alarm.
- Distinguishing signal for AI origin: check `scripts/fetch_ai_usage.js` output and PR labels to determine whether the commit was AI-assisted. Record this either way — attribution matters for the post-mortem, not for blame.

### 4.2 Immediate Containment (target: < 2 h for exploitable flaws)
1. **Triage severity:** Is it exploitable in production? Does it expose data or break integrity? Exploitable → treat as a security incident and invoke the standard (non-AI) security IR process *in parallel*; this playbook then governs the AI-process dimension.
2. **Stop exposure:** feature-flag off, revert the commit, or hotfix. Prefer revert for subtle logic errors — a "quick fix" written under pressure by the same class of tool is how a second incident happens.
3. **Freeze the pipeline path:** if the flaw passed `ai-review.mjs`/`audit-gate.mjs`, note the exact version of prompts/scripts used (for forensics) before anyone updates them.
4. **Hunt siblings:** run a targeted scan for the same pattern in other AI-assisted PRs from the same period (agents repeat patterns — one flaw rarely travels alone).

### 4.3 Remediation
1. Fix with a test that fails *before* the fix (red-green), written or at minimum reviewed by a human who independently re-derives the requirement — not by asking the original agent "is this fixed now?" without fresh context.
2. Re-run the full verification pipeline; for security flaws add the case to the security review template (`template-library/review/security-review.md`).
3. Assess exposure window: for data-affecting bugs, quantify affected records and notify per the data breach process if personal data was corrupted or exposed.

### 4.4 Post-Mortem & Policy Update
- Root-cause the *pipeline*, not the model: which layer should have caught it and didn't (tests, AI review, human review, audit gate)?
- **Hardening menu — pick based on the failure:**
  - *Same agent wrote tests and code:* mandate author-diversity for security-critical paths (different model or human-written acceptance tests).
  - *AI review rubber-stamped it:* add the flaw class to `ai-review.mjs` checklist; require human security review for auth/permission/data-handling changes regardless of AI review verdict.
  - *No test at the boundary:* require characterization tests for touched legacy paths.
  - *Audit gate didn't flag it:* extend `audit-gate.mjs` rules.
- Update the AI Risk Assessment if the failure reveals a new risk dimension (e.g., "agent-permitted destructive migrations").

---

## 5. Playbook 3 — Regulatory Breach (High-Risk or Prohibited AI feature deployed)

**Typical scenarios (per the AI Risk Assessment):** The Task Prioritization feature ships with sentiment analysis of *worker emotion* (🔴 Prohibited, Art. 5 emotion recognition at work) instead of task-text analysis; a manager-facing allocation view (🟠 High Risk, Annex III 4b) is enabled without a Conformity Assessment; AI review metrics leak into HR/performance decisions, breaking the HR Firewall.

### 5.1 Detection
- Feature review / release checklist reveals a capability that crosses a classification boundary in the Risk Assessment ("Re-Classification Triggers": role change, consumption change, feature expansion).
- Product analytics or a support ticket shows AI output being consumed in a prohibited way (e.g., a manager exporting AI scores for reviews).
- A/B config or feature flag shows the prohibited model path enabled in some tenant.
- Prompt/engineer review of the model: prompts analyzing tone/emoji/biometrics of *people* rather than *task text*.

### 5.2 Immediate Containment (target: < 24 h; S1 if Prohibited feature is live)
1. **Disable the capability at the flag/route level** — not just the UI. If emotion/sentiment analysis of workers ran at all, also stop *processing*: pause the feature's background jobs so no further prohibited analysis occurs.
2. **Freeze data.** Quarantine every output the feature produced (scores, rankings, recommendations). These are now potential evidence and potentially unlawful processing of employee data — do not let them flow into any HR system.
3. **Notify the AI Governance Officer and DPO immediately.** This playbook has a hard handoff: legal/works-council consultation duties may apply (especially in DE/EU contexts) — engineering does not decide notification alone.
4. **Preserve the deployment record:** commit, PR, review approvals, CI logs — needed to establish who knew what, and whether gates were bypassed.

### 5.3 Remediation
1. **Re-classify:** update the AI Risk Assessment; if the feature is genuinely wanted as High-Risk, that triggers the full Conformity Assessment / CE-marking track *before* any re-release — do not "fix and redeploy" a Prohibited feature with tweaks.
2. **Prohibited variant:** the analysis-of-human-emotion path is scrapped, not gated. Document the destruction/quarantine of the outputs it produced.
3. **Data cleanup:** delete or anonymize prohibited outputs per DPO guidance; check whether they were exported downstream (HR tools, spreadsheets, BI).
4. **Transparency:** if workers or users were subjected to prohibited analysis, the DPO decides on notification to affected employees; draft communication with legal.

### 5.4 Post-Mortem & Policy Update
- Determine how it crossed the design gate: missing checkpoint, ambiguous requirement ("sentiment" ambiguity is the known trap — see Risk Assessment constraint #1), or deliberate shortcut under deadline.
- **Policy updates:**
  - Add a **classification gate to the release checklist**: every AI-touching PR must state its Risk Assessment classification; changes touching the Prioritization/Allocation area require Governance Officer sign-off.
  - Codify the boundary in code: a guard in `audit-gate.mjs` that fails CI if prompts in the prioritization module reference worker-emotion fields (tone-of-person vs. text content).
  - Re-affirm the **HR Firewall**: automated check that no AI review/prioritization data lands in HR systems.
- File the incident as a Re-Classification Trigger event in the Risk Assessment change log.

---

## 6. Incident Record Template

```markdown
## AI Incident: <ID> — <one-line summary>
- Date detected / declared / resolved:
- Severity: S?   · Playbook used: 1/2/3
- AI tools involved (from inventory): OpenCode + <model/provider> …
- What happened (facts only):
- Detection source: precommit / audit-gate / trace review / human report / production
- Containment actions & timestamps:
- Exposure assessment (what left our control / who was affected):
- Notifications made (DPO, provider, regulator, affected people) & rationale:
- Root cause (process level):
- Policy/automation changes (with PR links):
- Residual risk & follow-ups:
```

## 7. Drills

Run a tabletop exercise once per quarter: rotate one scenario (leak, AI-bug, prohibited-feature), 60 minutes, using this document only. Success criterion: gaps found and filed as policy PRs — not that the drill goes smoothly.
