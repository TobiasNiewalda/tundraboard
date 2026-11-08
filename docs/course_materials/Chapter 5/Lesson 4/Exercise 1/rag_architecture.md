# RAG-Powered Code Search Architecture: TundraBoard (Revised)

## 1. Indexing Strategy (Code-Centric)
Standard character-based chunking is insufficient for code. The system will implement a structural indexing approach.

### Indexing Sources
- **Source Code:** All `.ts` files in `src/`.
- **Schema:** `prisma/schema.prisma` (indexed as whole-file units).
- **Metadata:** `README.md`, `package.json`, and `.npmrc`.
- **Symbol Table:** A map of exported functions, classes, and types using a symbol index (via Tree-sitter or LSP).

### Advanced Chunking & Metadata
- **AST-Aware Chunking:** Use an Abstract Syntax Tree (AST) to chunk code at logical boundaries (functions, classes, route handlers).
- **Context Headers:** Every chunk will be prepended with a header containing its file path, module name, and related imports to preserve semantic context during embedding.
- **Hashing:** Track chunk hashes to enable incremental updates via git hooks rather than full re-indexing.

## 2. Tech Stack

### Embedding Model
- **Primary:** `jina-code-embeddings-1.5B`.
- **Reasoning:** SOTA for code retrieval; supports task-conditioned prefixes (e.g., `nl2code` for natural language to code search); 32K context window prevents truncation of long functions.
- **Fallback:** `text-embedding-3-small` (for no-GPU environments).

### Vector Database
- **Choice:** **pgvector** (PostgreSQL extension).
- **Reasoning:** TundraBoard already runs PostgreSQL. `pgvector` allows for combined SQL metadata filtering and vector similarity search in a single query, eliminating the need for a separate vector store like Pinecone or ChromaDB.

## 3. Retrieval Pipeline (Hybrid Approach)
To solve the "lexical gap" where embeddings struggle with specific identifiers (e.g., `prisma.$transaction`), the system uses a hybrid pipeline:

1.  **Query Routing:** Determine if the query is a **Concept** (e.g., "how does auth work?") or an **Identifier** (e.g., "where is `validateSession` defined?").
2.  **Dual-Path Retrieval:**
    - **Dense Path:** Vector search via `jina-code-embeddings-1.5B` in `pgvector`.
    - **Lexical Path:** BM25/Keyword search using Postgres `tsvector` or `ripgrep`.
3.  **Reciprocal Rank Fusion (RRF):** Merge the results from both paths to create a single ranked list of candidates.
4.  **Reranking:** Use a code-aware cross-encoder (e.g., `jina-reranker-v3`) to refine the top 20 candidates.

## 4. Generation Pipeline
1.  **Context Assembly:** Combine the top-reranked chunks with their AST-derived metadata.
2.  **Prompting:** Use a system prompt that enforces:
    - Strict adherence to provided context.
    - Mandatory file path citations for every code reference.
    - Formatting of implementation examples in TypeScript.
3.  **LLM:** High-reasoning models accessed via **OpenRouter** (e.g., **Gemma 4** for efficiency and high reasoning density, or **GLM 5.3** for complex technical synthesis).

## 5. Infrastructure & Evaluation
- **Compute:** Python 3.10+ with a GPU for `jina` embeddings; PostgreSQL with `pgvector` installed.
- **Orchestration:** `langchain` or `llama-index`.
- **Golden Dataset:** A curated set of 30-50 "Question $\rightarrow$ Target File" pairs to measure **Recall@K** and **MRR**, ensuring pipeline changes are data-driven.
