# Build vs. Buy: RAG-Powered Code Search for TundraBoard

**Companion to:** `rag_architecture.md`
**Scenario:** Team of 10–50 developers, daily use for onboarding, bug hunting, and architectural queries.
**Date:** November 2026

---

## 1. Recommendation (TL;DR)

**Buy — and shift from Vector RAG to Agentic Search.**

TundraBoard should not build the full Vector RAG pipeline as originally designed. The industry has shifted: for code, "Agentic Search" (navigating files via ASTs and tools) has proven more performative and accurate than "Vector Search" (guessing via embeddings). At a team size of 10–50, the TCO of a custom build far exceeds the cost of commercial tools that have already integrated these agentic patterns.

**The Pragmatic Path:**
1. **Buy a commercial agentic tool** (Cursor Teams or Copilot Enterprise).
2. **Use the Golden Dataset as a Benchmark**, not as an infrastructure target.
3. **Build the "Differentiating 20%"** via MCP tools (symbol indices) only if the commercial tool fails the benchmark.
4. **Deploy a lightweight Open-Source Knowledge Base** (e.g., Onyx) specifically for non-code documentation.

---

## 2. The Knowledge vs. Code Trade-off

A critical distinction must be made between searching for *concepts* in documents and searching for *logic* in code.

### Knowledge Retrieval (Docs, Wikis, PDFs)
**Winner: Vector RAG**
- **Nature:** Unstructured data without a formal grammar.
- **Mechanism:** Embeddings are the most efficient way to find "concepts" across thousands of pages.
- **Recommendation:** Use **Onyx (ex-Danswer)** or **AnythingLLM** for a self-hosted, private knowledge base.

### Code Retrieval (TypeScript, Prisma, Repos)
**Winner: Agentic Search (Symbol-based)**
- **Nature:** Highly structured, strictly typed, and interdependent.
- **Mechanism:** Instead of "guessing" via vectors, agents use tools (`grep`, `read`, `ls`) to navigate the codebase. This preserves the logical flow and avoids the "context soup" of random chunks.
- **Recommendation:** Use **Cursor Teams** or **Copilot Enterprise**. If a self-hosted "map" is needed, use **CocoIndex** or **Chonks** as MCP servers.

---

## 3. The Contenders

| | TundraBoard Custom Build | GitHub Copilot Ent. | Cursor (Teams) | Onyx (ex-Danswer) |
|---|---|---|---|---|
| **Primary Use** | Bespoke RAG | Agentic Code Search | Agentic Code Search | Knowledge RAG |
| **Mechanism** | Vector DB + RRF | Agentic + Cloud Index | Agentic + Cloud Index | Vector DB (Local) |
| **Cost @ 25 devs** | ~$45–100k/yr (FTE) | ~$12k/yr | ~$12k/yr | Low (Self-hosted) |
| **Sovereignty** | High (Local) | Low (Cloud Index) | Low (Cloud Prompt) | High (Local) |
| **Precision** | Medium (Chunk-based) | High (Agentic) | High (Agentic) | Medium (Concept) |

---

## 4. Hidden Costs of BUILDING (The "Engineering Trap")

Building the architecture in `rag_architecture.md` creates a liability stream:
- **Index Freshness:** Git hooks break on rebases and renames. A "stale index" is a silent failure that destroys developer trust.
- **The Golden Dataset Rot:** 30–50 Q$\rightarrow$file pairs must be manually updated as the Prisma schema evolves, or the evals become meaningless.
- **Opportunity Cost:** 8–13 weeks of senior engineering is 1–2 product features not shipped. For a product company, infrastructure that is a commodity is the wrong place to spend the scarcest resource.

---

## 5. Hidden Costs of BUYING (The "SaaS Tax")
- **Data Privacy:** Code is indexed on vendor clouds. Mitigation requires moving to the most expensive "Enterprise" tiers or using self-hosted tools like Onyx.
- **Lock-in:** Semantic maps are not portable. Switching vendors resets context quality to zero for weeks.
- **Specialization Gap:** Generic chunkers may struggle with `schema.prisma` logic. This is the only area where a custom "Symbol Index" (via MCP) provides a real advantage.

---

## 6. Final Verdict & Execution Path

**Decision: BUY the daily driver, BUILD the thin map.**

### Phase 0: The Benchmark (Week 1)
Convert the Golden Dataset into an **acceptance test**. Run the questions through Cursor/Copilot. If they hit $\ge 80\%$ of the target files, stop building the RAG pipeline immediately.

### Phase 1: The Stack (Weeks 1–4)
- **For Code:** Deploy **Cursor Teams** or **Copilot Enterprise**.
- **For Knowledge:** Deploy a Docker instance of **Onyx** for the team's non-code documentation.

### Phase 2: The Differentiating 20% (Only if triggered)
If the commercial tools fail the benchmark on TundraBoard-specific logic (e.g., complex RBAC in the Prisma schema), do not build a Vector DB. Instead, build a **Symbol Index MCP Server** (using CocoIndex or similar). This provides the agent with a "perfect map" of the codebase without the overhead of embedding GPUs and vector stores.

**Bottom Line:** Leverage the market for the commodity 80% (indexing and chat UI) and focus engineering effort on the 20% that is unique to TundraBoard's domain logic.
