# AI Standards: Scenario Tests — TundraBoard Team

This document serves as a practical application guide for the `AI_Standards_V2.md` document. It walks through common real-world scenarios to ensure the team knows how to apply the standards in practice.

---

## Scenario A: The "Mystery Package" Hallucination
**The Situation:** During a PR review, a senior developer notices that the AI has introduced a new dependency: `prisma-query-optimizer`. The developer has never heard of this package, and it is not in the project's approved library list.

### 1. Which section applies?
- **Section 4: Code Review & Verification** $\rightarrow$ **AI-Specific Review Heuristics** (specifically "Hallucination Check" and "Dependency Bloat").
- **Section 4: Code Review & Verification** $\rightarrow$ **The Verification Pipeline** (Step 5: Security Scan).

### 2. Steps to follow:
1.  **Immediate Verification:** The reviewer should not assume the package is real. They must check the public npm registry. If the package doesn't exist or looks suspicious (e.g., very low downloads, no documentation), it is confirmed as an **AI Hallucination**.
2.  **Pipeline Check:** The reviewer checks if the `npm audit` in the Verification Pipeline flagged the package. If the package was hallucinated, the build might have failed at the `npm install` stage, but if it's a "typosquatted" real package, the security scan is the last line of defense.
3.  **Author Notification:** The reviewer flags the code in the PR, pointing to the **AI-Specific Review Heuristics** section of the standards, noting that the author failed to verify the existence of the library.
4.  **Correction:** The author must remove the hallucinated package and implement the logic using approved, existing libraries (e.g., native Prisma queries).

### 3. Expected Outcome:
- The hallucinated package is removed before the code ever reaches the `main` branch.
- The author is reminded that **"The author owns the code, regardless of the tool,"** and that "it looked correct" is not a valid defense for importing unknown dependencies.

---

## Scenario B: The "Quick Debug" Request
**The Situation:** A junior developer posts in the team Slack/Discord: *"Hey, I'm stuck on this one function for the Client X project. Can I just quickly paste it into my personal ChatGPT account to debug it? I'll delete the chat right after!"*

### 1. Which section applies?
- **Section 1: Approved Tools** (The "three-slot" strategy).
- **Section 2: Data Handling** $\rightarrow$ **Data Classification & Prompting Rules** (specifically "Confidential" and "Internal" classifications).
- **Section 2: Data Handling** $\rightarrow$ **The "Never Prompt" List**.

### 2. The Answer:
**"No."** Even for a "quick" debug, using a personal account for client-specific project code is a violation of the TundraBoard AI Standards.

### 3. What the junior should do instead:
1.  **Use the Approved Reasoning Workspace:** The junior should use the **Enterprise-tier Claude or ChatGPT account** specified in the "Approved Tools" table, where "Training on my data" is disabled.
2.  **Apply Context Management:** Instead of pasting the whole project, they should use the **Minimal Viable Context** approach—pasting only the specific function and the necessary TypeScript interfaces.
3.  **Sanitize PII:** Ensure no actual client data (PII) or secrets are included in the snippet, as per the "Never Prompt" list.

### 4. How the team should help:
1.  **Guide to Tools:** A peer or lead should share the link to the `AI_Standards_V2.md` document and help the junior set up their access to the Enterprise tools.
2.  **Pair Prompting:** A senior dev can show the junior how to create a "Minimal Viable Context" snippet so they can debug effectively without risking a data leak.
3.  **Educational Moment:** Explain the difference between "Personal" and "Enterprise" tiers (specifically regarding data training), helping the junior understand that "deleting the chat" does not remove the data from the provider's training logs.

### 5. Expected Outcome:
- The code remains within the secure, Enterprise-approved environment.
- The junior developer is onboarded into the correct workflow, preventing future security risks.
