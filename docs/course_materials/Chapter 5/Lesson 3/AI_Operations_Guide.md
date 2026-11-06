# AI Operations Guide — TundraBoard

> This guide operationalizes the AI Governance Framework. It defines the rhythm of compliance, the response to failures, and the path for new team members.

---

## 1. Compliance Calendar

This calendar operationalizes the [AI Governance Framework](AI_Risk_Assessment.md) for the TundraBoard development team. It converts the obligations of the EU AI Act (in particular **Art. 4 — AI Literacy**) and the [IP & Accountability Policy](IP_Policy.md) into a recurring schedule of audits, reviews, and training activities.

**Governing principles:**
- The **Commander Principle** (human accountability for all AI-assisted output) applies at every activity in this calendar.
- Compliance is **event-driven first, calendar-driven second**: recurring checks are the safety net, not the primary control.
- Every activity must produce **evidence** (a dated record) to demonstrate accountability.

### 1.1 Annual Overview

| Cadence | Activity | Owner | Reference |
| :--- | :--- | :--- | :--- |
| **Continuous / Event-driven** | Key rotation on compromise; new-tool admission; re-classification triggers | Feature Owner / Commander | §3, §5, §6 |
| **Per New Hire** | AI Literacy onboarding (Art. 4) | Team Lead | §4 |
| **Quarterly** | AI Tool Inventory audit (DPA / Enterprise agreement verification) | AI Governance Lead | §2.1 |
| **Quarterly** | Periodic key rotation sweep | Security Champion | §3.2 |
| **Bi-annual** | Policy & Risk Assessment review | AI Governance Lead | §2.2 |
| **Annual** | Full framework review (calendar itself, inventory structure, training materials) | Team Lead | §7 |

### 1.2 Recurring Compliance Activities

#### 1.2.1 Quarterly AI Tool Inventory Audit
**When:** First working week of each quarter (Jan / Apr / Jul / Oct).
**Scope:** Every entry in the [AI Tool Inventory](AI%20inventory.md) — tools, models, gateways, and MCP servers.

| Audit Step | Check | Pass Criteria |
| :--- | :--- | :--- |
| 1. Completeness | Are all tools actually in use listed? | No undeclared tool usage (ask team; review CI/CD and editor configs). |
| 2. Contract status | Is the **Enterprise Agreement / DPA** still valid and current? | Status is not "TBD / Under Review"; contract renewal date > 90 days away or renewal initiated. |
| 3. Data flow | Is the recorded data flow (prompts, storage, training) still accurate? | Vendor terms unchanged; "no training on user data" guarantees still in place for client projects. |
| 4. Risk classification | Is the EU AI Act classification still correct? | Classification matches current tool functionality; no unassessed new features. |
| 5. Retirement | Are unused tools removed or marked deprecated? | Inventory reflects reality; deprecated tools have revocation of API keys noted. |

**Known open items**: DeepSeek, Qwen, GLM (Z.ai), and OpenRouter are recorded as **"TBD / Under Review"** — their DPA/data-retention status must be resolved before they may be used for client-project prompts.

**Evidence:** Dated audit log entry per tool (✅ verified / ⚠️ remediation required / ❌ suspended).

#### 1.2.2 Bi-annual Policy Review
**When:** March and September.
**Scope:**
- [IP & Accountability Policy](IP_Policy.md) — including the Commander Principle wording and disclosure workflows.
- [AI Risk Assessment](AI_Risk_Assessment.md) — even without a trigger event (see §6).
- Related standards (AI Development Standards, "Never Prompt" list).

**Process:** Draft changes $\rightarrow$ review with team $\rightarrow$ approval $\rightarrow$ version bump $\rightarrow$ brief the team on deltas (15 min in a regular sync).

---

### 1.3 Key & Credential Rotation Schedule

#### 1.3.1 Event-Driven Rotation (Immediate — highest priority)
Rotate the affected credential **immediately** when any of the following occurs:
- Key/token detected in code, CI logs, or AI prompts.
- Developer offboarding or role change.
- Vendor security incident / breach notification.
- Vendor contract termination (e.g., failing a quarterly audit).
- Suspected prompt-injection exfiltration or anomalous gateway usage.

#### 1.3.2 Periodic Rotation
| Credential Type | Cadence | Notes |
| :--- | :--- | :--- |
| AI provider API keys | Every 90 days | Rotate during the quarterly audit window. |
| Gateway credentials | Every 90 days | High-value keys; rotate frequently. |
| CI/CD secrets (AI automation) | Every 90 days | Verify least-privilege scope on each rotation. |
| Observability platform keys | Every 180 days | Keys receiving prompt traces. |

---

### 1.4 AI Literacy Onboarding (Art. 4 — New Hires)
Every new team member must complete the following **before their first autonomous AI-assisted commit**:
1. Read the [IP & Accountability Policy](IP_Policy.md) — sign acknowledgment of the **Commander Principle**.
2. Review the [AI Tool Inventory](AI%20inventory.md).
3. Complete Chapter 5 course materials.
4. Walkthrough of the "Never Prompt" list.
5. Understand re-classification duty.

**Evidence:** A per-person training record (dates + acknowledgments).

---

### 1.5 New Tool Admission (Event-Driven)
Before any new AI tool is used:
1. **Add to Inventory** with proposed classification.
2. **Contract check**: Enterprise agreement / DPA status determined (no "TBD").
3. **Data-flow check**: Determine training opt-outs and API regions.
4. **Risk assessment**: Classify under EU AI Act; check HR/performance implications.

### 1.6 Re-Classification Triggers
A new Risk Assessment is **mandatory** when:
- **Role Change**: Deployer $\rightarrow$ Provider.
- **Consumption Change**: AI outputs used in HR/performance decisions.
- **Feature Expansion**: Analyzing human emotion instead of task text.
- **Functionality Change**: Vendor adds background execution or changes data retention.
- **Regulatory Update**: New EU AI Office guidance.

---

## 2. AI Incident Response Plan

**Status:** Draft v1.0 · **Owner:** Engineering Lead + AI Governance Officer

### 2.1 Scope & Roles
| Role | Responsibility |
| :--- | :--- |
| **Incident Commander (IC)** | Directs the response. Defaults to on-call engineering lead. |
| **AI Governance Officer** | Owns re-classification and regulatory notification judgment. |
| **Responder(s)** | Execute containment/remediation steps. |

**Universal rules:** Declare early $\rightarrow$ Preserve evidence $\rightarrow$ Assume propagation $\rightarrow$ Stop the source first.

**Severity Matrix:**
- **S1**: Real-world harm likely or regulator/72h clock engaged (e.g., Prohibited feature live).
- **S2**: Contained or internal-only, but requires coordinated response (e.g., PII pasted into prompt).
- **S3**: Near-miss / policy violation without exposure (e.g., secret caught by pre-commit scan).

### 2.2 Playbook 1 — Data Leakage (Secrets/PII in Prompts)
1. **Detection**: Secret scanner flags a prompt; trace review shows credentials; human report.
2. **Immediate Containment**: **Revoke first, investigate second**. Rotate all affected credentials. Kill running agent sessions.
3. **Tier-Specific Response**:
    - **Enterprise-Tier/API**: Revoke key $\rightarrow$ Request deletion via DPA $\rightarrow$ Verify deletion confirmation.
    - **Personal-Tier/Chat**: Treat as a **Public Leak**. Acknowledge that data may be ingested into global training sets without a deletion guarantee. Trigger S1 severity response.
4. **Remediation**: Verify scope via gateway logs; assess GDPR Art. 33 notification obligations; purge secondary copies.
5. **Post-Mortem**: Update "never in agent context" list; move TBD providers to "suspended" status if DPA is missing.

### 2.3 Playbook 2 — AI-Generated Bugs & False-Positive Blocks
1. **Detection**: Post-merge security scan, production anomaly, or a **Critical Release Block** caused by an incorrect AI security claim.
2. **Immediate Containment**: Triage severity. Revert the commit or use feature-flag to disable.
3. **Emergency Override Protocol (For False-Positive Blocks)**:
    - **Bypass Authority**: If an AI-review bot blocks a critical release with a false positive, an override requires dual-signoff from the **Lead Architect** and **Security Officer**.
    - **Rule Suppression**: The specific faulty AI rule or prompt pattern must be "muted" or suppressed in the `ai-review.mjs` config to prevent further blocking of the release.
    - **Override Log**: The decision to bypass the AI bot must be documented in the PR with a technical justification to prevent "normalization of deviance."
4. **Remediation**: Fix with a test that fails *before* the fix; mandate author-diversity for security-critical paths.
5. **Post-Mortem**: Root-cause the *pipeline* failure; update `ai-review.mjs` checklist; extend `audit-gate.mjs` rules.

### 2.4 Playbook 3 — Regulatory Breach (High-Risk/Prohibited Feature)
1. **Detection**: Release checklist reveals a capability crossing a risk boundary (e.g., emotion analysis).
2. **Immediate Containment**: Disable the capability at the route/flag level. Quarantine all outputs. Notify AI Governance Officer and DPO immediately.
3. **Remediation**: Re-classify as High-Risk and trigger full Conformity Assessment (CE marking) OR scrap the prohibited variant.
4. **Post-Mortem**: Determine how the design gate was bypassed; add a classification gate to the release checklist.

### 2.5 Playbook 4 — License/Copyright Infringement
1. **Detection**: Flagged by CI license scanners, manual audit, or external notification of infringing patterns.
2. **Immediate Containment**: Mark the affected code as "Tainted." Immediately stop any further distribution or deployment of the version containing the infringing code.
3. **Remediation**: 
    - **Taint Analysis**: Use code similarity scans (e.g., Snyk, Black Duck) to isolate the scope of the infringement and check for "copyleft contamination."
    - **Replacement**: Replace the infringing implementation with a clean, human-verified version.
    - **History Scrub**: Perform a `git filter-repo` or `bfg` rewrite to remove the tainted code from the project history, preventing future legal liability.
    - **Sibling Hunt**: Identify if the same AI-generated pattern was reproduced in other modules.
4. **Post-Mortem**: Identify if the infringement was due to "memorization" of training data. Update the prompt library to avoid the pattern and refine the "Minimal Viable Context" rules to prevent over-reliance on specific copyrighted frameworks.

---

## 3. AI Onboarding Checklist (First Week)

### Day 1 — Tool Setup & Account Tiers
- [ ] **IDE Assistant — Cursor** (Business tier) installed.
- [ ] **Terminal Agent — Claude Code** (Pro/Enterprise) installed (`ask-for-write` required).
- [ ] **Reasoning Workspace — Claude / ChatGPT** (Enterprise) - **"Training on my data" disabled**.
- [ ] Know the model defaults: Fast for CRUD; Reasoning for complex refactors/security.

### Day 1–2 — Mandatory Reading
- [ ] **AI Development Standards** (`docs/course_materials/Chapter 5/Lesson 1/AI_Standards.md`)
- [ ] **AI IP & Accountability Policy** (`docs/course_materials/Chapter 5/Lesson 3/IP_Policy.md`)
- [ ] **AI Risk Assessment** (`docs/course_materials/Chapter 5/Lesson 3/AI_Risk_Assessment.md`)
- [ ] Review the **AI Tool Inventory**.

### Day 2–3 — Commander Principle Sign-Off
- [ ] I have read and understood the Commander Principle: **I am 100% accountable for every line committed**.
- [ ] I understand that "the AI wrote it" is never an acceptable explanation.
- [ ] I understand the extra-scrutiny areas: JWT/RBAC, Prisma migrations, performance queries.
- [ ] I understand autonomous agent work requires explicit PR-level disclosure.

### Day 3–4 — Verification Task (Hands-On)
- [ ] Use a prompt template from `promts/` to generate a unit test for a real utility function.
- [ ] Ensure **Minimal Viable Context** was used (no whole files).
- [ ] Pass the local pipeline: `tsc` $\rightarrow$ `eslint` $\rightarrow$ `prettier` $\rightarrow$ `vitest` $\rightarrow$ `npm audit`.
- [ ] Submit via PR; this serves as the **Art. 4 AI-literacy training record**.

### Day 5 — Incident Response Briefing
- [ ] Know the reporting targets: Lead Architect and Security Officer.
- [ ] Understand the Data Leak protocol: Report $\rightarrow$ Rotate $\rightarrow$ Cleanup.
- [ ] Understand the AI Bug protocol: Escalate $\rightarrow$ Root-cause $\rightarrow$ Harden pipeline.
- [ ] I know the incident protocols live in the AI Operations Guide.
