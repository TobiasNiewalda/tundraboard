# RAG-Powered Code Search Architecture v2: Agentic & Hybrid Approach

## 1. The Evolution: From Vector RAG to Agentic Search
Version 1 relied on a "Passive Retrieval" model (Embed $\rightarrow$ Search $\rightarrow$ Generate). While effective for prose, this approach fails in code because it lacks structural awareness and struggles with exact identifiers.

**Architecture v2** shifts to an **"Active Navigation"** model. Instead of treating code as a set of disconnected chunks, it treats the codebase as a navigable graph of symbols and files.

---

## 2. Indexing Strategy (Structural & Lexical)

### The "Knowledge Map" (Sovereign Index)
Rather than just vectorizing text, v2 builds three parallel indices:
1.  **Symbol Index (AST):** Uses Tree-sitter to map every function, class, and type definition to its exact file/line coordinates.
2.  **Lexical Index (BM25):** A traditional inverted index for exact token matching (e.g., searching for `prisma.$transaction`).
3.  **Semantic Index (Dense):** `jina-code-embeddings-1.5B` vectors used primarily for "conceptual" discovery (e.g., "find the part of the code that handles user onboarding").

### Indexing Granularity
- **Code:** Chunked by AST boundaries (Function/Class level) with mandatory "Context Headers" (imports, file path, related types).
- **Docs:** Chunked by semantic sections (Headings/Lists).
- **Schema:** The `schema.prisma` file is indexed as a single, high-priority unit.

---

## 3. Tech Stack

### Embedding & Inference
- **Primary Embedding:** `jina-code-embeddings-1.5B` (via Sentence-Transformers).
- **Reasoning LLM:** **Gemma 4** or **GLM 5.3** (via OpenRouter).
- **Reranker:** `jina-reranker-v3` for final candidate refinement.

### Storage & Interface
- **Database:** **pgvector** (PostgreSQL).
- **Interface:** **MCP (Model Context Protocol)**. The system is exposed as a set of MCP tools (`search_symbols`, `read_file`, `grep_code`) that the LLM can call.

---

## 4. The Retrieval Pipeline (The Agentic Loop)

Unlike v1's linear pipeline, v2 uses a **Reasoning Loop**:

1.  **Intent Analysis:** The LLM determines if the query is **Conceptual** (e.g., "How does auth work?") or **Targeted** (e.g., "Where is `validateSession`?").
2.  **Multi-Path Retrieval:**
    - **Conceptual Path:** Vector search $\rightarrow$ Rerank $\rightarrow$ Candidate files.
    - **Targeted Path:** Symbol lookup $\rightarrow$ Lexical search $\rightarrow$ Exact file coordinates.
3.  **Agentic Navigation:** The LLM does not just accept the top 5 chunks. It uses MCP tools to:
    - `read_file` to see the full context of a retrieved function.
    - `follow_import` to find where a type is defined.
    - `grep` to find all usages of a specific variable.
4.  **Synthesis:** Only after the agent has "explored" the relevant files does it synthesize the final answer.

---

## 5. Generation Pipeline

1.  **Dynamic Context Window:** Instead of a fixed set of chunks, the context is built dynamically as the agent navigates.
2.  **Strict Grounding:** The system prompt enforces:
    - *"Do not guess. If the agentic search did not find the symbol, state that it is missing."*
    - *"Provide full file paths and line numbers for every cited snippet."*
3.  **Verification Step:** The LLM is prompted to "verify" its answer by searching for contradictory logic in the related files before finalizing.

---

## 6. Evaluation & Maintenance

### The Golden Dataset 2.0
Evals are no longer just `Recall@K`. They are measured as:
- **Path Accuracy:** Did the agent find the correct file?
- **Navigation Efficiency:** How many tool calls were required to find the answer?
- **Synthesis Correctness:** Did the final answer accurately reflect the code logic?

### Maintenance
- **Incremental Updates:** Triggered via git hooks to update the Symbol and Lexical indices in real-time.
- **Zero-Rebuilds:** Use of Matryoshka embeddings to allow dimension scaling without full re-indexing.
