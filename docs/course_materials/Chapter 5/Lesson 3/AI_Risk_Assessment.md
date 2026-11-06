# AI Risk Assessment — TundraBoard

This document classifies the AI use cases within TundraBoard according to the EU AI Act risk framework. This is a living document; any change in AI tool functionality, deployment role (Provider vs. Deployer), or how AI output is consumed (especially by HR or management) triggers an immediate re-assessment.

## Risk Classification Framework (EU AI Act)
The EU AI Act uses a four-tier risk system:
- 🔴 **Unacceptable Risk**: Prohibited (e.g., social scoring, emotion recognition in the workplace).
- 🟠 **High Risk**: Heavily regulated (e.g., critical infrastructure, HR screening, worker evaluation).
- 🟡 **Limited Risk**: Transparency obligations (e.g., chatbots, synthetic-content labeling).
- 🟢 **Minimal Risk**: No high-risk obligations, but Art. 4 (AI Literacy) applies.

---

## Use Case Analysis

### 1. AI-Assisted Development (Internal)
**Description**: Use of AI coding assistants (Cursor, OpenCode, Claude Code, etc.) to generate, refactor, and debug the TundraBoard codebase.

| Dimension | Detail |
| :--- | :--- |
| **Risk Classification** | 🟢 **Minimal Risk** |
| **Justification** | Assists developers in a professional capacity. It does not make autonomous decisions affecting legal rights or safety. |
| **Compliance Requirements** | **Art. 4 AI Literacy**: All deployers must ensure staff have sufficient AI literacy. GDPR obligations for prompt data processing apply. |
| **Specific Actions** | 1. Maintain the **AI Tool Inventory**.<br>2. Enforce the **IP Policy** (Accountability/Ownership).<br>3. **Training Record**: Document the "Commander Principle" and Chapter 5 course materials as evidence of AI literacy training. |

### 2. AI-Powered PR Review & Workflow Automation (Internal)
**Description**: Use of tools like CodeRabbit or GitHub Actions to provide automated code reviews, suggest improvements, and potentially block merges.

| Dimension | Detail |
| :--- | :--- |
| **Risk Classification** | 🟡 **Limited Risk** (with a hard boundary) |
| **Justification** | Influences professional workflow. While often treated as "Minimal," it moves to **High Risk** (Annex III 4b) if the AI output is used to evaluate worker performance or behavior. |
| **Compliance Requirements** | **Transparency**: Users must be aware of AI interaction. **HR Firewall**: Strict separation between AI review data and performance management. |
| **Specific Actions** | 1. **Disclosure**: Mark AI-generated review comments as "🤖 AI Review".<br>2. **Human-in-the-Loop**: Strict rule: No PR can be blocked *solely* by an AI; human maintainer override is mandatory.<br>3. **HR Firewall**: Explicitly prohibit the ingestion of AI review metrics into formal performance reviews, promotions, or termination decisions. |

### 3. AI-Powered Task Prioritization (Hypothetical User-Facing)
**Description**: A TundraBoard feature that uses AI to analyze task content (urgency, tone, deadlines) to suggest prioritization.

| Dimension | Detail |
| :--- | :--- |
| **Risk Classification** | 🟢 **Minimal** $\rightarrow$ 🟠 **High Risk** (Context Dependent) |
| **Justification** | **Minimal**: A simple suggestion/sort for a user's personal list. **High Risk (Annex III 4b)**: If used by a manager to allocate tasks to employees based on behavioral profiling or personal traits. **Prohibited**: If "sentiment" analysis involves emotion recognition of workers in the workplace. |
| **Compliance Requirements** | **Transparency**, **Human Oversight**, **Accuracy/Robustness**, and **Data Governance**. |
| **Specific Actions** | 1. **Constraint**: "Sentiment" must strictly analyze *task text* (e.g., "urgent," "blocking"), never the *worker's emotional state*.<br>2. **Explainability**: Provide a "Why?" tooltip for prioritization logic.<br>3. **Active Control**: Allow users to easily override or disable AI prioritization.<br>4. **Design Gate**: If the feature evolves into "Worker Allocation," it must trigger a full Conformity Assessment (CE marking) program before release. |

---

## Governance Summary Matrix

| Use Case | Risk Level | Primary Requirement | Primary Control | Role |
| :--- | :--- | :--- | :--- | :--- |
| Dev Assistance | Minimal | AI Literacy (Art. 4) | Commander Principle & Training | Deployer |
| PR Review | Limited | Transparency & Boundary | HR Firewall & Human Override | Deployer |
| Task Prioritization | Min $\rightarrow$ High | Transparency $\rightarrow$ Conformity | Content-only analysis $\rightarrow$ CE Marking | Provider |

## Re-Classification Triggers
The following events trigger an immediate update to this assessment:
1. **Role Change**: Moving from using a 3rd party tool (Deployer) to branding and selling a custom AI feature (Provider).
2. **Consumption Change**: Using AI outputs (e.g., PR review stats) in any HR or performance-related decision.
3. **Feature Expansion**: Adding "sentiment" analysis that moves from analyzing *text* to analyzing *human emotion*.
4. **Regulatory Update**: New guidance from the EU AI Office regarding specific "High Risk" categories.
