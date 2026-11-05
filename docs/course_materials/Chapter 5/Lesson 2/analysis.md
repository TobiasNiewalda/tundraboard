# AI Impact Measurement Analysis - TundraBoard

## Selected Key Metrics

The following metrics have been selected to measure the impact of AI adoption. Given that TundraBoard is a solo development project, these metrics focus on the most impactful and trackable dimensions while omitting team-centric metrics (like PR turnaround or onboarding time).

### 1. Cycle Time (Velocity)
- **What it measures:** The time elapsed from the first commit of a feature/fix to its deployment/completion.
- **Why it matters:** It is the primary indicator of delivery speed. AI should reduce the "friction" of boilerplate and complex logic implementation, shortening the path from idea to finished code.
- **How to capture:** Git commit timestamps and deployment logs (or manual tracking of "feature start" to "merge").
- **Baseline value:** 3 days (estimated average for a solo dev on a small feature).
- **Target value (3 months):** 2 days.

### 2. Test Coverage (Quality)
- **What it measures:** The percentage of the codebase exercised by automated tests.
- **Why it matters:** AI can generate tests rapidly, but there is a risk of "hallucinated" tests or superficial coverage. Increasing coverage ensures that AI-generated features are robust and maintainable.
- **How to capture:** Integrated coverage tools (e.g., `jest` or `vitest` coverage reports in CI).
- **Baseline value:** 40% (common for early-stage solo projects).
- **Target value (3 months):** 70%.

### 3. Security Findings (Quality)
- **What it measures:** The number of vulnerabilities or security smells detected by static analysis.
- **Why it matters:** AI can occasionally introduce insecure patterns (e.g., SQL injection, hardcoded keys). Tracking findings ensures that AI-accelerated development doesn't compromise security.
- **How to capture:** Static analysis tools (e.g., Snyk, SonarQube, or GitHub Advanced Security).
- **Baseline value:** 5 medium/high findings.
- **Target value (3 months):** < 2 findings.

### 4. Tool Utilisation (Dev Exp)
- **What it measures:** The frequency and depth of interaction with the AI tool (e.g., prompts per day, percentage of code accepted from AI).
- **Why it matters:** Validates whether the AI tool is actually becoming part of the daily workflow or if it's just a novelty.
- **How to capture:** OpenRouter usage logs and plugin analytics.
- **Baseline value:** 20 prompts/day.
- **Target value (3 months):** 50 prompts/day (reflecting deeper integration into architectural and refactoring tasks).

### 5. AI Tool Spend (Cost)
- **What it measures:** The monthly expenditure on AI model tokens and subscriptions.
- **Why it matters:** Ensures that the cost of the tools is proportionate to the value (productivity) gained. Since OpenRouter is pay-as-you-go, this is a direct measure of resource consumption.
- **How to capture:** OpenRouter billing dashboard and API usage reports.
- **Baseline value:** $10/month.
- **Target value (3 months):** $25/month (anticipating higher usage of "reasoning" models like o1 or Claude 3.5 Sonnet for complex tasks).

## Proposed Dashboard Layout

The dashboard is designed as a single-page executive view to monitor the health of AI adoption.

| Metric | Visual Representation | Comparison to Baseline | Refresh Frequency | Alert Threshold (Investigate if...) |
| :--- | :--- | :--- | :--- | :--- |
| **Cycle Time** | **Trend Line** (Days per feature) | Current vs. 3-day baseline | Daily | Average increases > 4 days for 3 consecutive features. |
| **Test Coverage** | **Gauge** (0% $\rightarrow$ 100%) | Current vs. 40% baseline | Per Commit (CI) | Coverage drops by > 5% in a single merge. |
| **Security Findings** | **Table** (Sorted by Severity) | Count vs. 5-finding baseline | Weekly | Any "Critical" or "High" vulnerability is introduced. |
| **Tool Utilisation** | **Bar Chart** (Daily Prompt Volume) | Current vs. 20 prompts/day | Daily | Utilisation drops below 10 prompts/day for a week. |
| **AI Tool Spend** | **Trend Line** (USD per month) | Current vs. $10/month | Weekly | Monthly spend exceeds $40 without a corresponding dip in Cycle Time. |
