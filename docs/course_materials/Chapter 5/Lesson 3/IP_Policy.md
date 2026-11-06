# AI Intellectual Property & Accountability Policy

## 1. Purpose and Scope
This policy defines the standards for the generation, review, and ownership of code produced with the assistance of Artificial Intelligence (AI) within the TundraBoard project and associated ventures. It aims to leverage AI productivity while maintaining strict engineering quality and legal compliance.

## 2. Ownership and Accountability
### 2.1 The Commander Principle
The TundraBoard development team operates on a **Commander/Owner model**. AI agents are treated as tools, not authors. 

- **Absolute Accountability**: The human developer (the "Commander" or Feature Owner) is 100% accountable for every line of code committed to the repository, regardless of whether it was handwritten or AI-generated.
- **No "AI-Bugs"**: There is no such thing as an "AI-generated bug." Any defect, security vulnerability, or logic error introduced by an AI tool is the responsibility of the developer who reviewed and committed the code.
- **Quality Gate**: AI-generated code must meet or exceed the same quality, performance, and security standards as human-written code.

## 3. Disclosure and Transparency
### 3.1 Standard Workflow (Human-in-the-Loop)
For the majority of development where a human developer reviews and commits the code:
- **Implicit Disclosure**: No inline comments or per-function markers are required. It is implied that AI may be used as a productivity assistant.
- **Policy Override**: This supersedes previous requirements in the *AI Development Standards* to tag AI-generated sections in PR descriptions.
- **Prerequisite**: This implicit disclosure is only valid as long as a human reviewer has vetted the code and the "Commander Principle" is upheld.

### 3.2 Autonomous/Auto-Merge Workflow
In cases where AI agents are granted permissions to create branches or trigger autonomous merges:
- **PR-Level Disclosure (Option B)**: AI usage must be explicitly disclosed in the Pull Request description (e.g., *"This branch was scaffolded/modified by [Agent Name]"*).
- **Audit Trail**: Every autonomous change must be traceable to the agent and the specific prompt/instruction that triggered it.

## 4. License and Security Compliance
### 4.1 Prevention of Leakage and Infringement
To prevent the accidental introduction of copyrighted patterns, license contamination, or the leakage of proprietary logic:
- **Developer Responsibility**: Developers must not blindly trust AI output. Critical logic, encryption, and security-sensitive modules require manual verification.
- **Automated Scanning (Pre-PR)**: Before code reaches PR review, it must pass through a verified scanning pipeline:
    - **License & Similarity Scanning**: Use tools such as **GitHub Copilot's Public Code Filter**, **Snyk**, or **FossID** to detect copyleft licenses (e.g., GPL-3.0) and identify code similarity to public repositories.
    - **Secret Scanning**: Use regex-based pre-commit hooks to detect and block the commit of secrets/tokens.
- **Incident Response**: If a production token/key is detected in the CI pipeline:
    1. An immediate warning must be triggered.
    2. The key must be considered compromised and **rotated immediately**.
    3. The commit must be scrubbed from history.

### 4.2 Training Data Mitigations
While a global "no-training" rule is not enforced for all tools, the following mitigations apply:
- **TBD Provider Restriction**: The input of proprietary source code, client-specific logic, or sensitive internal architectures into any tool marked as **"TBD / Under Review"** in the AI Tool Inventory is **strictly prohibited**. These tools may only be used for generic, public-domain coding tasks until a formal Enterprise Agreement with a training opt-out is signed.
- **Project-Specific Opt-Outs**: For highly regulated or proprietary projects, the team must use AI tools with explicit "No Training" enterprise agreements.
- **Local Deployment**: Where data sensitivity is critical, the team shall prioritize the use of locally deployed models (e.g., Llama via local inference) to ensure no data leaves the controlled environment.

## 5. Data Sensitivity and Privacy
### 5.1 Prohibited Inputs
Developers are strictly forbidden from providing the following to any AI tool:
- **Production API Keys**: Use only dummy/test keys during development.
- **Real PII (Personally Identifiable Information)**: Use synthetic or anonymized data for prompting and testing.
- **Client Secrets**: Never input raw client secrets into an AI prompt.

### 5.2 Filtering
The team will implement and maintain filters and pre-commit checks to minimize the risk of sensitive data exfiltration.

## 6. Governance Alignment
This policy is the governing document for AI usage. For the technical implementation of these rules (e.g., the specific Verification Pipeline, the "Never Prompt" list, and Tool Slots), refer to the [AI Development Standards](AI_Standards.md). 

In the event of a conflict between the *AI Development Standards* and this *IP Policy*, this policy takes precedence.

