# AI Tool Inventory — TundraBoard Development Team

This document maintains a comprehensive inventory of all AI tools used, developed, or considered for the TundraBoard project. This inventory is a key component of the AI Governance Framework to ensure compliance with the EU AI Act and data protection regulations.

## Tool Inventory

| Tool Name | Purpose | Vendor | Enterprise Agreement / DPA Status | Data Flow (Prompts, Storage, Training) | EU AI Act Risk Classification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Cursor** | AI-powered IDE for code generation and background agent tasks. | Anysphere | Enterprise Tier Required (for client projects) | Prompts sent to model providers; indexing happens locally or in cloud depending on settings. | Minimal Risk |
| **OpenCode** | AI coding agent harness for tool execution and codebase management. | OpenCode | Enterprise Agreement / DPA Required | Local tool execution; data flow depends on configured model providers. | Minimal Risk |
| **Claude Code** | Terminal-based agent for autonomous project-level changes. | Anthropic | Enterprise Agreement / DPA Required | Prompts sent to Anthropic API; data storage and training governed by Enterprise terms. | Minimal Risk |
| **GitHub Copilot** | Coding assistant and autonomous development agent. | GitHub (Microsoft) | Enterprise Agreement / DPA Required | Prompts sent to GitHub/Azure; training exclusion usually managed via Enterprise settings. | Minimal Risk |
| **Devin** | Long-horizon autonomous background agent. | Cognition AI | Enterprise Agreement / DPA Required | Full workspace state and prompts sent to Cognition; ephemeral environment for execution. | Minimal Risk |
| **Claude (Model)** | Foundational LLM for reasoning and coding. | Anthropic | Enterprise Agreement / DPA Required | API-based flow; enterprise tier excludes training on user data. | Minimal Risk (as tool) / GPAI (as model) |
| **GPT (Model)** | Foundational LLM for reasoning and coding. | OpenAI | Enterprise Agreement / DPA Required | API-based flow; enterprise tier excludes training on user data. | Minimal Risk (as tool) / GPAI (as model) |
| **Gemini (Model)** | Foundational LLM with computer-use capabilities. | Google | Enterprise Agreement / DPA Required | API-based flow; governed by Google Cloud Vertex AI/AI Studio terms. | Minimal Risk (as tool) / GPAI (as model) |
| **DeepSeek (Models)** | LLMs with extended thinking and coding capabilities. | DeepSeek | TBD / Under Review | Prompts sent to DeepSeek API; check for training opt-outs. | Minimal Risk |
| **Qwen (Models)** | High-performance LLMs for coding and reasoning. | Alibaba Cloud | TBD / Under Review | Prompts sent to Alibaba Cloud API; requires DPA check for EU compliance. | Minimal Risk |
| **GLM (Z.ai)** | Advanced LLMs for multi-modal and coding tasks. | Z.ai | TBD / Under Review | Prompts sent to Z.ai API; requires DPA check for EU compliance. | Minimal Risk |
| **Llama** | Open-source foundational model. | Meta | Open Weights (Local Deployment) | Local deployment: No data flow to vendor. Cloud deployment: Follow provider DPA. | Minimal Risk |
| **LiteLLM** | AI Gateway for unifying multiple LLM APIs. | LiteLLM | Enterprise Agreement / DPA Required | Acts as a proxy; data flows through the gateway to the target model provider. | Minimal Risk |
| **OpenRouter** | Unified API aggregator for accessing multiple LLM providers. | OpenRouter | TBD / Under Review | Prompts are routed through OpenRouter to the selected model provider; check data retention policies. | Minimal Risk |
| **E2B** | Cloud sandbox for ephemeral Linux VMs. | E2B | Enterprise Agreement / DPA Required | Execution occurs in isolated VMs; logs sent to user's observability tool. | Minimal Risk |
| **Langfuse** | AI observability and trajectory evaluation. | Langfuse | Enterprise Agreement / DPA Required | Traces and logs sent to Langfuse; potential for PII exfiltration risk. | Minimal Risk |
| **Arize Phoenix** | AI observability and trajectory evaluation. | Arize | Enterprise Agreement / DPA Required | Traces and logs sent to Arize; potential for PII exfiltration risk. | Minimal Risk |
| **LangSmith** | Debugging and evaluation of AI agents. | LangChain | Enterprise Agreement / DPA Required | Traces and logs sent to LangSmith. | Minimal Risk |
| **Weave** | AI observability and weaving. | Weights & Biases | Enterprise Agreement / DPA Required | Traces and logs sent to W&B. | Minimal Risk |
| **MCP Servers** | Integration protocols for connecting tools. | Community/Various | N/A (Protocol) | Local data flow between client and server; remote servers depend on specific vendor DPA. | Minimal Risk |
| **Browser Use / Stagehand** | UI automation agents. | Open Source | N/A (Local execution) | Prompts sent to chosen LLM provider; browser data processed locally. | Minimal Risk |
| **CodeRabbit** | AI-powered automated PR reviews and summaries. | CodeRabbit | Enterprise Agreement / DPA Required | Full PR context sent to provider; depends on model (GPT/Claude) for processing. | Minimal to Limited Risk |
| **GitHub Actions (AI)** | Automation of AI-driven reviews, linting, or testing. | GitHub (Microsoft) | Enterprise Agreement / DPA Required | Data processed within GitHub Actions runners; depends on the integrated AI tool. | Minimal to Limited Risk |

## AI Execution & Sandboxing Infrastructure

These tools are used to isolate AI agents from the host system, mitigating the risk of accidental or malicious system changes and ensuring a controlled environment for autonomous execution.

| Tool Name | Type | Purpose | Governance/Risk Mitigation |
| :--- | :--- | :--- | :--- |
| **Docker** | Container | Lightweight isolation for tool execution and environment replication. | Resource limits, network isolation, image scanning. |
| **MicroVMs (e.g. Firecracker)** | Virtual Machine | Strong kernel-level isolation for high-risk autonomous agent execution. | Hard boundary between agent and host; rapid startup/teardown. |
| **E2B** | Cloud Sandbox | Ephemeral, secure Linux environments for agents. | Managed isolation; prevents local host contamination. |

## Classification Notes

- **Minimal Risk**: Most AI-assisted coding tools are classified as "Minimal Risk" under the EU AI Act because they support human developers without making autonomous decisions that significantly affect individuals.
- **GPAI (General Purpose AI)**: The underlying models (Claude, GPT, Gemini) are classified as GPAI systems. The providers are responsible for systemic risk and transparency obligations.
- **Limited Risk**: AI features that interact directly with end-users (e.g., a customer-facing TundraBoard chatbot) would be classified as "Limited Risk" and require transparency disclosures.
- **High Risk**: Any AI used for HR screening or critical infrastructure (not currently used in TundraBoard development) would be "High Risk".
