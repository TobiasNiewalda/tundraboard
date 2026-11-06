# AI Compliance Calendar — TundraBoard

This calendar operationalizes the [AI Governance Framework](AI_Risk_Assessment.md) for the TundraBoard development team. It converts the obligations of the EU AI Act (in particular **Art. 4 — AI Literacy**) and the [IP & Accountability Policy](IP_Policy.md) into a recurring schedule of audits, reviews, and training activities.

**Governing principles:**
- The **Commander Principle** (human accountability for all AI-assisted output) applies at every activity in this calendar.
- Compliance is **event-driven first, calendar-driven second**: recurring checks are the safety net, not the primary control.
- Every activity must produce **evidence** (a dated record) to demonstrate accountability.

---

## 1. Annual Overview

| Cadence | Activity | Owner | Reference |
| :--- | :--- | :--- | :--- |
| **Continuous / Event-driven** | Key rotation on compromise; new-tool admission; re-classification triggers | Feature Owner / Commander | §3, §5, §6 |
| **Per New Hire** | AI Literacy onboarding (Art. 4) | Team Lead | §4 |
| **Quarterly** | AI Tool Inventory audit (DPA / Enterprise agreement verification) | AI Governance Lead | §2.1 |
| **Quarterly** | Periodic key rotation sweep | Security Champion | §3.2 |
| **Bi-annual** | Policy & Risk Assessment review | AI Governance Lead | §2.2 |
| **Annual** | Full framework review (calendar itself, inventory structure, training materials) | Team Lead | §7 |

---

## 2. Recurring Compliance Activities

### 2.1 Quarterly AI Tool Inventory Audit

**When:** First working week of each quarter (Jan / Apr / Jul / Oct).
**Scope:** Every entry in the [AI Tool Inventory](AI%20inventory.md) — tools, models, gateways, and MCP servers.

| Audit Step | Check | Pass Criteria |
| :--- | :--- | :--- |
| 1. Completeness | Are all tools actually in use listed? | No undeclared tool usage (ask team; review CI/CD and editor configs). |
| 2. Contract status | Is the **Enterprise Agreement / DPA** still valid and current? | Status is not "TBD / Under Review"; contract renewal date > 90 days away or renewal initiated. |
| 3. Data flow | Is the recorded data flow (prompts, storage, training) still accurate? | Vendor terms unchanged; "no training on user data" guarantees still in place for client projects. |
| 4. Risk classification | Is the EU AI Act classification still correct? | Classification matches current tool functionality; no unassessed new features. |
| 5. Retirement | Are unused tools removed or marked deprecated? | Inventory reflects reality; deprecated tools have revocation of API keys noted. |

**Known open items** (carry into every audit until closed): DeepSeek, Qwen, GLM (Z.ai), and OpenRouter are recorded as **"TBD / Under Review"** — their DPA/data-retention status must be resolved before they may be used for client-project prompts.

**Evidence:** Dated audit log entry per tool (✅ verified / ⚠️ remediation required / ❌ suspended).

### 2.2 Bi-annual Policy Review

**When:** March and September.
**Scope:**

- [IP & Accountability Policy](IP_Policy.md) — including the Commander Principle wording and disclosure workflows.
- [AI Risk Assessment](AI_Risk_Assessment.md) — even without a trigger event (see §6).
- Related standards (AI Development Standards, "Never Prompt" list).

**Process:** Draft changes → review with team → approval → version bump → brief the team on deltas (15 min in a regular sync).

**Additional trigger:** Any material update to the EU AI Act (e.g., new guidance from the EU AI Office, updated GPAI codes of practice) accelerates the next policy review; it must not wait for the next scheduled slot.

---

## 3. Key & Credential Rotation Schedule

### 3.1 Event-Driven Rotation (Immediate — highest priority)

Rotate the affected credential **immediately** when any of the following occurs:

| Trigger Event | Action |
| :--- | :--- |
| Key/token detected in code, CI logs, or AI prompts | **Rotate now**; treat as compromised; scrub from history; run incident review. |
| Developer offboarding or role change | Revoke personal API keys/tokens; rotate shared keys within 24 h. |
| Vendor security incident / breach notification | Rotate all keys held with that vendor; verify data-flow exposure. |
| Vendor contract termination (e.g., failing a quarterly audit) | Revoke keys the same day the tool is suspended. |
| Suspected prompt-injection exfiltration or anomalous gateway (LiteLLM/OpenRouter) usage | Rotate downstream provider keys and audit trace logs (Langfuse/Phoenix). |

### 3.2 Periodic Rotation

| Credential Type | Cadence | Notes |
| :--- | :--- | :--- |
| AI provider API keys (Anthropic, OpenAI, Google, etc.) | Every 90 days (aligned with quarterly audit week) | Rotate during the quarterly audit window to minimize disruption. |
| Gateway credentials (LiteLLM, OpenRouter) | Every 90 days | Gateway keys grant access to *many* providers — treat as high-value. |
| CI/CD secrets used by AI automation (GitHub Actions) | Every 90 days | Verify least-privilege scope on each rotation. |
| Observability platform keys (Langfuse, Arize, LangSmith, W&B) | Every 180 days | These receive traces that may contain prompt data. |

**Rule of thumb:** if a secret grants access to prompt data or code context, it rotates at least every 90 days; everything else at least every 180 days.

---

## 4. AI Literacy Onboarding (Art. 4 — New Hires)

Every new team member must complete the following **before their first autonomous AI-assisted commit** (target: within the first two weeks):

| # | Requirement | Verification | Deadline |
| :--- | :--- | :--- | :--- |
| 1 | Read the [IP & Accountability Policy](IP_Policy.md) — sign acknowledgment of the **Commander Principle** | Signed record | Day 1 |
| 2 | Review the [AI Tool Inventory](AI%20inventory.md): which tools are approved, which are "TBD" and require lead approval | Quiz/discussion with Team Lead | Week 1 |
| 3 | Complete Chapter 5 course materials (Commander Principle, risk tiers, disclosure rules) | Completion recorded in training log | Week 2 |
| 4 | Walkthrough of the "Never Prompt" list (no production keys, no real PII, no client secrets) | Signed acknowledgment | Day 1 |
| 5 | Understand re-classification duty: report new AI usage or new use of AI output to the Governance Lead | Covered in onboarding session | Week 1 |

**Evidence:** A per-person training record (dates + acknowledgments) — this is the deployer's proof of Art. 4 compliance.

**Refresher:** All staff re-confirm the policy set during the bi-annual policy review briefing (§2.2). Material policy changes require acknowledgment from *all* team members, not only new hires.

---

## 5. New Tool Admission (Event-Driven)

Before any new AI tool, model, or MCP server is used for project work:

1. **Add to Inventory** with proposed classification (copy the inventory table schema).
2. **Contract check:** Enterprise agreement / DPA status determined — no "TBD" at the moment of first project use.
3. **Data-flow check:** Where do prompts go? Is there a training opt-out? (Route through LiteLLM/OpenRouter only if the downstream provider terms are acceptable.)
4. **Risk assessment:** Classify under the EU AI Act framework; note if the tool's output could feed HR/performance decisions (⇒ Limited/High risk rules apply).
5. **Brief the team** if the tool will be commonly used.

The next quarterly audit verifies the entry formally.

---

## 6. Re-Classification Triggers (Event-Driven — act immediately)

A new Risk Assessment (full or delta) is **mandatory** when any of these occurs:

| # | Trigger | Consequence |
| :--- | :--- | :--- |
| 1 | **Role Change** — the team moves from using a 3rd-party tool (Deployer) to branding/selling an AI feature (Provider) | Provider obligations (technical documentation, conformity assessment) may apply. |
| 2 | **Consumption Change** — AI outputs (e.g., CodeRabbit review stats) are used in any HR or performance decision | PR-review use case escalates 🟡 → 🟠 High Risk (Annex III 4b); enforce the HR Firewall instead. |
| 3 | **Feature Expansion** — e.g., "sentiment" analysis moves from analyzing *task text* to *human emotion* | Potential 🟠 High Risk or even 🔴 Prohibited (emotion recognition at work). |
| 4 | **Functionality Change** — a vendor adds agentic/background execution, new data retention, or training-on-inputs | Update inventory data flow + re-check classification. |
| 5 | **Regulatory Update** — new EU AI Office guidance or delegated acts affecting our use cases | Re-assess affected use cases; possibly accelerate the policy review. |
| 6 | **New High-Stakes Use** — AI touches hiring, worker evaluation, credit, safety, or critical infrastructure | Full assessment before any use. |

**Rule:** When in doubt, classify *higher* and record the reasoning; a documented conservative classification is compliant, an undocumented optimistic one is not.

---

## 7. Annual Full Framework Review

**When:** January (combined with Q1 audit week).

- Review this calendar itself: are cadences sufficient given tool changes?
- Review the inventory schema and classification notes against the current EU AI Act state of implementation.
- Review aggregate training records (Art. 4 evidence) and audit logs for gaps.
- Set the year's audit dates and confirm role assignments (Governance Lead, Security Champion).

---

## 8. Responsibility Matrix

| Activity | Accountable | Consulted |
| :--- | :--- | :--- |
| Quarterly inventory audit | AI Governance Lead | All developers |
| Key rotation | Security Champion | Feature Owner (Commander) |
| Policy review | AI Governance Lead | Team Lead |
| Onboarding & training records | Team Lead | Governance Lead |
| Re-classification | AI Governance Lead | Feature Owner |
| Incident response (leaked keys, exfiltration) | Feature Owner + Security Champion | Governance Lead |

---

*Aligned with: [AI Tool Inventory](AI%20inventory.md) · [AI Risk Assessment](AI_Risk_Assessment.md) · [IP & Accountability Policy](IP_Policy.md). In case of conflict, the IP Policy takes precedence.*
