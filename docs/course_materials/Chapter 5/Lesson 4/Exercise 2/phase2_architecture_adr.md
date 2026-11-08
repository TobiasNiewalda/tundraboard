# Phase 2: Architecture Decision Record — Search Engine for Advanced Task Search

**ADR-001:** Use integrated PostgreSQL full-text search (Option A) for `GET /workspaces/:workspaceId/tasks/search`
**Date:** November 8, 2026
**Status:** Accepted
**Deciders:** Backend / platform (capstone Exercise 2, Phase 2)
**Depends on:** `phase1_requirements_analysis.md` (approved requirements), `authenticate` JWT middleware (blocker, external to this decision)
**Alternatives considered:** Elasticsearch, Meilisearch, Algolia (Option B family); ILIKE + trigrams; Postgres + cache tier

---

## 1. Context

TundraBoard must ship workspace-scoped task search: FTS over `title`/`description`, composable
`status`/`priority`/`assigneeId`/`projectId` filters, six sort keys including `relevance` and a
mapped `priority` rank, and cursor (keyset) pagination — under p95 ≤ 300 ms at 100k tasks per
workspace with 100 concurrent searchers (Phase 1 NFR-P.1).

The current estate:

- **PostgreSQL 16** is the only stateful service (`.devcontainer/docker-compose.yml`; README names
  Supabase/Neon free tiers as hosting). Postgres is the **system of record** for a multi-tenant
  dataset where workspace membership is the security boundary.
- **FTS infrastructure already ships**: `search_vector tsvector GENERATED ALWAYS ... STORED`
  (title → weight A, description → weight B, English config), GIN index `tasks_search_vector_idx`,
  and `listTasks` already parses with `websearch_to_tsquery` (`20261020000000_add_full_text_search`).
- **Tenancy is relational**: `tasks` has no `workspace_id` column; scope exists only via
  `tasks.project_id → projects.workspace_id` (Phase 1 §1.2 finding 1). Every search query must
  scope through `projects`.
- Team is small; the repo adds dependencies only via Prisma/Express/Zod conventions. No existing
  queue, worker, or CDC infrastructure.

This ADR decides **Option A (integrated Postgres)** vs **Option B (external search engine)**,
evaluated on four axes: retrieval precision & recall (with focus on the *priority mapping* and
*workspace scoping* requirements), operational complexity (deploy, dual-write, maintenance),
performance as task count grows 10k → 1M, and cost & sovereignty.

---

## 2. Decision drivers (weighted)

| # | Driver | Weight | Why it's weighted this way |
|---|---|---|---|
| D1 | Multi-tenant correctness of workspace scoping | **Critical** | A leak is a security incident; Phase 1 makes scope a *structural* property of the endpoint (NFR-S.1) |
| D2 | Meeting NFR-P.1 (p95 ≤ 300 ms @ 100k/ws) | High | Hard requirement, but a *known, modest* target |
| D3 | Operational surface a small team can own | High | No dedicated search/infra team; the app must not acquire systems it can't operate |
| D4 | Data freshness for board UX | Medium | Users search immediately after editing; stale index = visible bug |
| D5 | Relevance quality (typos, partial words) | Medium | Nice-to-have; Phase 1 explicitly deferred trigram/fuzzy to v2 (v2 candidates §5) |
| D6 | Cost & sovereignty | Medium | Customer task data is tenant IP; residency/GDPR deletion must stay simple |

---

## 3. The alternatives

| Option | What it means here |
|---|---|
| **A — Integrated PostgreSQL FTS** | Build on the existing tsvector generated column + GIN index + `websearch_to_tsquery`. New: one parameterized search query, composite sort indexes, cursor codec. |
| **B1 — Elasticsearch (self-hosted)** | Dedicated cluster; app or CDC writes documents; engine enforces scope via a denormalized `workspace_id` field. |
| **B2 — Meilisearch (self-hosted)** | Lightweight single-binary engine; typo-tolerant, great DX; still requires an index pipeline. |
| **B3 — Algolia (SaaS)** | Fully managed relevance engine; pay per records + operations; data leaves our estate. |
| A′ — `ILIKE` + `pg_trgm` only | Rejected by Phase 1 (E3): the sanctioned search path is the tsvector column; ILIKE has no ranking and no stemming. |
| A″ — Postgres + Redis cache in front | Rejected: caching doesn't improve recall/precision, and invalidation re-creates a mini dual-write problem. |

---

## 4. Analysis by axis

### 4.1 Retrieval precision & recall

**Workspace scoping (the requirement, not just a filter).**

- **A:** scope is enforced *where the data's relationships live*. The query joins
  `tasks → projects` and predicates `p.workspace_id = $1` in the same `WHERE` that paginates, in
  the same transaction, against the authoritative data. There is no copy of the relationship to go
  stale, and forgetting the join is caught by a single review surface (the one query builder).
- **B:** scope must be **denormalized into the index** — every document carries `workspace_id`
  written from a join at ingest time, and the engine filter is trusted for ACL. Failure modes are
  new and specific: a pipeline bug writes a document with a missing/wrong `workspace_id`
  (filters fail closed — no leak, but *silent missing results* that look like the leak's twin);
  or the query path forgets the filter and returns cross-tenant rows with no relational guard rail
  behind it. Permission decisions move into a second system that only has whatever copy of the
  ACL truth we feed it. On the "404 indistinguishable" contract (NFR-S.2): nothing here changes
  it — membership is still checked before any search — but B widens the *distance* between
  authorization code and the code that actually selects rows.

**Priority mapping (`low < medium < high < urgent`, never lexicographic).**

- **A:** one expression does it — `CASE t.priority WHEN 'low' THEN 1 ... 'urgent' THEN 4 ELSE 0 END`.
  `ELSE 0` also implements E12: unknown stored values (webhook writes bypass Zod) sort deterministically
  instead of 500-ing. The mapping lives *next to the column it sorts*, in the same reviewable file as the sort.
- **B:** the engine cannot sort by a string mapping either — you must index a numeric
  `priority_rank` onto each document at ingest. Same `CASE`, relocated to the *write path*, so any
  future remapping ("drop medium? reorder tiers?") becomes a **reindex of all tenants** instead of
  a one-line query change. Strictly worse for this requirement.

**Relevance quality.**

- **A:** `websearch_to_tsquery` is operator-tolerant and never throws (junk input can't 500 or leak
  SQL semantics), AND-of-terms matches search-box expectation; the A/B weighting makes title hits
  outrank description hits via `ts_rank`. Ceiling: `ts_rank` is a simple TF/IDF-family score (not
  BM25), English stem dictionary only, **no typo tolerance, no infix matching** (`tundr` ✗
  `tundraboard`), no accents folding (`café` ≠ `cafe`), no synonyms.
- **B (Meili/ES/Algolia):** typo tolerance, prefix/infix, better ranking models, faceting.
  Real advantage — **and the spec deliberately buys it back** by scoping fuzzy/trigram to v2.
  The app compensates for `ts_rank`'s coarseness *behaviorally*: board users disambiguate with
  status/priority/assignee filters and re-sort by date, and E6's id-tiebreaker makes
  rank-tie groups deterministic and page-stable.

**Freshness (recall on content the user just changed).**

- **A:** the STORED generated column recomputes inside the same transaction as the row update —
  search sees an edit the instant it commits. Zero staleness, by construction.
- **B:** async ingest → 0.5–10 s typical lag; worse under backlog. For a board where "rename card,
  find card" is a normal interaction, this is a visible defect class we'd have to design around.

**Verdict:** B wins raw text-relevance; **A wins decisively on the two named requirements** —
scoping is structural rather than duplicated into an index, and the priority mapping stays a
query-side one-liner instead of an indexed attribute requiring reindex-on-change. A also wins
freshness. D5 (relevance polish) is the only axis B leads, and Phase 1 already deferred it.

### 4.2 Operational complexity

**A:**

- **Zero new services.** Devcontainer, CI, staging, prod unchanged. No new credentials, network
  paths, dashboards, or incident types.
- **The dual-write problem does not exist.** Index sync is the database's own write path
  (generated column, transactional). There is no second store to keep consistent, no "search says
  X, DB says Y" state to debug.
- Maintenance is ordinary Postgres: autovacuum on a table with a GIN index (pending-list flush via
  `fastupdate`; occasional bloat), the two composite indexes from NFR-P.2, `statement_timeout` on
  the search path. All of this is already on the team's critical path because Postgres must be
  run regardless.
- Schema coupling: the search query is raw SQL referencing physical columns (`t.search_vector`
  isn't in the Prisma schema). Risk is rename-drift; mitigated by typed row interfaces + the
  acceptance test suite that runs against a real DB.

**B:** the *entire section-5-of-Phase-1 concern list multiplies by a second system*:

- **Ingest pipeline** — pick one, none is free:
  1. App-level dual-write: write task, then engine → partial failure = permanent drift; needs
     retry queue + scheduled reconciliation sweeper. (Board apps have *high mutation rates* —
     status drags make this the worst possible write mix to dual-write.)
  2. Transactional outbox + worker: correct, but adds a queue/worker to operate (new subsystem in
     a repo that has none today).
  3. CDC/logical decoding (Debezium-class): the heaviest option, effectively infra-team work.
- **Topology & versioning:** ES = JVM heap sizing, shard/mapping management, rolling upgrades,
  reindex-on-schema-change rituals; Meili = simpler, but its embedded database and snapshot format
  still pin upgrade paths; Algolia = no servers, but index/settings become code you version against a vendor API.
- **Tenancy plumbing:** one index with a `workspace_id` filter (every query must remember it — see
  4.1) vs per-workspace indexes (thousands of tenants → index explosion + tenant lifecycle
  events: create/pause/**delete** all become dual-system operations).
- **Two deletion/backup paths** (see 4.4).

**Verdict:** A adds one query builder, one cursor codec, two indexes. B adds a stateful second
system whose core failure mode (drift) is invisible until a user reports it. D3 alone is close to
dispositive for A.

### 4.3 Performance at scale (10k → 1M tasks)

The NFR target is **per workspace** (100k tasks/ws). What each option does as *total* corpus grows:

| Scale point | A (Postgres) | B (engine) |
|---|---|---|
| 10k tasks total | Warm queries single-digit ms. GIN bitmap scan → top-N sort → `LIMIT n+1`. Nothing to optimize. | Sub-ms. Both trivially inside budget. |
| 1M total, spread across many workspaces | The query shape decides. With scope-first filtering (`p.workspace_id`, or a `project_id = ANY(...)` semi-join from the cheap indexed `projects.workspace_id` btree) plus `tasks(project_id, ...)` composites, work per query is bounded by the *matching set within one workspace*, not the corpus. Typical board queries (term + filters, ≤100 returned, no COUNT) hold well under 300 ms p95. Keyset pages are O(limit) regardless of depth (E15). | Single node, sub-10 ms at 1M. Comfortable — but the *ingest* side (every drag = one doc update, refresh cadence) is the load at 1M, not query time. |
| 1M in few giant workspaces / very broad terms (e.g. `a`) | Known pressure points, in order: (1) a global GIN bitmap over common-word posting lists before scope filtering; (2) `ts_rank` computed over *all* matches to sort; (3) `ts_headline` per returned row. Mitigations, all in-database and measured before adopted: narrow `websearch_to_tsquery` AND-semantics; composite GIN `(project_id, search_vector)` / `(workspace_id, search_vector)` via `btree_gin`; same-DB denormalization of `workspace_id` onto `tasks` via trigger (transactional — *not* the external dual-write of B); `page`-CTE pattern (§5.4) so top-N sorts only ids+ranks; `statement_timeout` as the backstop. This is where A genuinely works for it. | Native comfort zone. |
| 10M+ / cross-entity corpora (comments, attachments) | Needs serious tuning or read replicas; search traffic competes with OLTP on one instance. | This is B's raison d'être. |

Write amplification: every `tasks` write already lexizes the STORED vector (existing cost, not new);
B *adds* the engine on top. At 1M tasks, A's honest worst case is tail-latency on pathological
queries — bounded by `statement_timeout` and revisited via §7 triggers. B's honest worst case is
pipeline lag/backlog — bounded by nothing except more infra.

**Verdict:** up to and beyond the 1M horizon in scope, A meets D2 with a concrete,
in-database mitigation ladder; B's performance headroom is real but buys throughput we don't
need at a tax we'd pay forever.

### 4.4 Cost & sovereignty

| | A | B1 ES | B2 Meili | B3 Algolia |
|---|---|---|---|---|
| Incremental infra | **$0** (same instance) | VMs/cluster + snapshots (meaningful $ + ops time) | 1 small VM + storage | SaaS, per-record + per-operation; grows with corpus & traffic |
| Where tenant data lives | One Postgres instance | Two systems (DB + index) | Two | **Vendor custody** — DPAs, sub-processors, export control |
| Tenant deletion / GDPR | `DELETE` on workspace cascades; one authoritative purge; backup = pg_dump/PITR | Purge DB **and** index; a missed purge = data-subject retention violation; two backup mechanisms | same | vendor API purge + export agreements |
| Lock-in | Postgres — already chosen irreversibly (Prisma datasource, system of record) | ES query DSL & mapping | Meili settings/API | Deepest: relevance config, client SDKs, no self-host parity |

**Verdict:** A is the only option where "delete this workspace" and "back this up" stay single-step.
B3 additionally fails D6 on principle for a multi-tenant product whose customers are the kind of
orgs that ask where their task data is; B1/B2 keep sovereignty but at the two-stores tax above.

### 4.5 Score summary (weights §2)

| Axis | A | B | Decisive reason |
|---|---|---|---|
| Precision & recall (as *specified*, incl. priority + scoping) | **wins** | | Scope structural; priority mapping query-side; zero staleness |
| Relevance polish (as *aspirational*) | | **wins** | typo/infix/BM25 — explicitly v2-scoped |
| Operational complexity | **wins by far** | | No dual-write, no new system |
| Performance at scale (to 1M) | pass | pass | Both meet D2; B's headroom unneeded at this horizon |
| Cost & sovereignty | **wins** | | $0 incremental, single data boundary |

---

## 5. Decision: Option A — integrated PostgreSQL search

Build `GET /workspaces/:workspaceId/tasks/search` on the existing `search_vector` generated
column, GIN index, and `websearch_to_tsquery`, as a single parameterized query in
`taskService.ts`. **Adopt no external engine.** Revisit only via the triggers in §7.

### 5.1 Why — the reasoning chain

1. **The requirements' two hardest points are relational, not textual.** Workspace scoping rides a
   join, priority mapping rides a `CASE`. Postgres does both *in the one query that must do them*
   (NFR-S.1 requires scoping "applied in the SQL WHERE clause before pagination" — external
   engines can't satisfy that sentence without re-importing the join).
2. **The dual-write problem the spec never mentions is the one B would add.** A's index freshness
   is transactional by construction; any B pipeline makes "search results vs board reality"
   drift a permanent, silent failure mode operated by a team of D3's size.
3. **The performance bar is workspace-bounded.** 1M tasks spread across tenants is ~100k per
   workspace *worst case*; keyset pagination + scope-first filtering + no COUNT keeps per-query
   work proportional to the slice and the page, not the corpus. B's headroom is paid for upfront
   and used at the horizon where we'd also want replicas anyway.
4. **Single data boundary.** One store = one purge, one backup, one residency story, $0 marginal
   infra — for the product's *security-critical* axis (tenant isolation), fewer authorities is a
   safety property, not just a preference.
5. **The relevance gap B would fill is already scheduled as v2 scope** (trigram/fuzzy were
   explicitly cut), and A keeps a cheap partial answer in-database
   (`pg_trgm` + FUSE/TrigramSimilarity, ParadeDB `pg_search` BM25 where the managed provider
   allows it — verify Supabase/Neon extension availability before counting on it).

### 5.2 Implementation strategy — sort expression: one source of truth

The root cause of every "cursor desynced from ORDER BY" bug is defining the sort twice. We define
it **once**, as a server-side allowlist of `Prisma.sql` fragments, and splice the *same fragment*
into `SELECT`, `WHERE` (keyset), and `ORDER BY`:

```ts
type Dir = "asc" | "desc";
const SORT_EXPR: Record<SortKey, (q: string | null, dir: Dir) => Prisma.Sql> = {
  // q's presence validated earlier (FR-3.2); never client text below — all ${...} are bound params
  relevance: (q) => Prisma.sql`ts_rank(t.search_vector, websearch_to_tsquery('english', ${q!}))`,
  createdAt: () => Prisma.sql`t.created_at`,
  updatedAt: () => Prisma.sql`t.updated_at`,
  // dueDate is the ONLY nullable sort key (title/status/priority/created/updated are NOT NULL;
  // CASE and ts_rank never return NULL). Sentinel makes NULL behave as "sorts last"
  // for BOTH directions, exactly mirroring `ORDER BY ... NULLS LAST` (FR-3.5, E7).
  dueDate: (_, dir) => dir === "desc"
    ? Prisma.sql`COALESCE(t.due_date, '-infinity'::timestamptz)`
    : Prisma.sql`COALESCE(t.due_date,  'infinity'::timestamptz)`,
  // E11 + E12: explicit rank; unknown stored values → 0 → deterministic, no 500
  priority: () => Prisma.sql`CASE t.priority
                  WHEN 'low' THEN 1 WHEN 'medium' THEN 2
                  WHEN 'high' THEN 3 WHEN 'urgent' THEN 4 ELSE 0 END`,
  title: () => Prisma.sql`t.title`,
};
```

`sortBy` comes from Zod → validated enum → this table lookup only; no client string ever reaches SQL text.

### 5.3 Implementation strategy — the cursor tiebreaker, in one query

**Keyset predicate = row-value comparison against the same fragment.** For `desc`
(`<` for `asc`), with `id` as final tiebreaker in the same direction (FR-3.4, E6):

```
( <SORT_EXPR>, t.id ) < ( <cursorV cast to expr's type>, <cursorId>::uuid )
```

Three properties make this exactly correct:

1. **Lexicographic row comparison mirrors the composite ORDER BY** — first the sort value, ties
   resolved by `id`. `uuid` has btree ordering in Postgres, so `id` comparison is total. (Note:
   this is byte-order, not insertion-order — fine; only *determinism* is required.)
2. **NULL-safe by the sentinel, not by luck.** Row-value `<` is three-valued under NULL
   (`ROW(NULL,'x') < ROW(1,'a')` → NULL → row silently vanishes), which would break pages over
   NULL `dueDate` (E7/E8). Because `NULLS LAST` means NULL behaves as the extreme of the order,
   `COALESCE(due_date, ±infinity)` maps that behavior onto the comparison. The sentinel never
   crosses the API boundary: the cursor encodes the *raw* value (`v: null` for a NULL row, per
   §4.2 cursor schema), and SQL re-coalesces the bound parameter (`COALESCE(${v}::timestamptz,
   '-infinity'::timestamptz)`).
3. **Relevance ties are the norm, and are handled.** `ts_rank` returns float4 and ties heavily
   (often exactly 0.0); `id DESC` after it gives the total order that makes page walks gap- and
   duplicate-free (E6). Rank recomputes per page — under concurrent edits a row can move between
   pages; that's E10's accepted point-in-time semantics, not a bug.

Cursor token: base64url(`{sortBy, sortOrder, v, id}`), decoded → strict Zod (E9) → `sortBy`/`sortOrder`
must match the query string (FR-4.3 → 400). `v` is re-cast per key: `::real` (relevance),
`::int` (priority), `::timestamptz` (dates), `::text` (title). A malformed cursor is a 400, never
a 500, and never interpolated.

### 5.4 Reference query (the `page`-CTE pattern)

All params present (`q` set, `sortBy=relevance`, `desc`, cursor, filters), illustrative:

```ts
const rows = await prisma.$queryRaw<TaskSearchRow[]>(Prisma.sql`
  WITH page AS (                       -- narrow: ids + sort value only → cheap top-N
    SELECT
      t.id,
      ${sortExpr} AS v                 -- SAME fragment, bound once here
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    WHERE p.workspace_id = ${workspaceId}                    -- NFR-S.1, structural
      AND ${filterConds}                                     -- composed Prisma.sql fragments:
      --   t.project_id = ANY(${ids}::uuid[])   (pre-validated against workspace, R1)
      --   t.status     = ANY(${statuses}::text[])
      --   t.priority   = ANY(${priorities}::text[])
      --   t.assignee_id = ${assignee}::uuid  |  t.assignee_id IS NULL   (E13)
      AND t.search_vector @@ websearch_to_tsquery('english', ${q})
      AND (${cursorId}::uuid IS NULL OR
           (${sortExpr}, t.id) < (${cursorV}::real, ${cursorId}::uuid))
    ORDER BY ${sortExpr} DESC NULLS LAST, t.id DESC
    LIMIT ${limit + 1}                 -- R2 over-fetch; no COUNT(*) (NFR-P.3)
  )
  SELECT t.*, p.title AS "projectTitle", u."displayName" AS "assigneeName", pg.v AS "sortV"
  FROM page pg
  JOIN tasks t     ON t.id = pg.id
  JOIN projects p  ON p.id = t.project_id
  LEFT JOIN users u ON u.id = t.assignee_id
  ORDER BY pg.v DESC NULLS LAST, pg.id DESC
`);
```

Design points:

- **Why the CTE**: the expensive parts (`ts_rank` over all matches, the sort) run on `(id, v)`
  only; full DTO assembly — joins for E16 embeds and `ts_headline` for FR-1.5 snippets — runs on
  the surviving ≤ `limit + 1` rows. This is what makes `limit ≤ 100` + `ts_headline` CPU stay
  inside NFR-P.1 (R2).
- **Snippets (FR-1.5, E16):** `ts_headline('english', coalesce(t.title,'')||' '||coalesce(t.description,''),
  websearch_to_tsquery('english', ${q}), 'StartSel=⟦,StopSel=⟧,MaxFragments=2')` — custom
  non-HTML sentinel delimiters, then server-side: HTML-escape the *whole* snippet, and replace
  `⟦`/`⟧` pairs (escape-safe strings) with `<mark>`/`</mark>`. `ts_headline` does **not** escape
  user content; the naïve "let it emit `<b>`" leaks stored markup.
- **hasMore/nextCursor:** slice to `limit`; `hasMore = fetched === limit + 1`; cursor built from
  the last row's `sortV` (raw value, NULL preserved) + `id`. Replay on last page → `200 []` (FR-4.5).
- **`q` empty-after-trim** → the `search_vector @@ ...` cond is simply omitted (E4); with no `q`,
  `relevance` is a 400 (FR-3.2) and default sort is `createdAt desc` (§4.1).
- Auth order (membership **before** query, NFR-S.3) and rate limit (NFR-S.6) are middleware/route
  concerns per R6, unchanged by this ADR.

### 5.5 Index & runtime plan (the only migration)

```sql
CREATE INDEX "tasks_project_created_idx" ON tasks (project_id, created_at DESC, id DESC);
CREATE INDEX "tasks_project_updated_idx" ON tasks (project_id, updated_at DESC, id DESC);
-- already present: tasks_search_vector_idx (GIN), tasks_project_id_idx,
--                  tasks_status_idx, tasks_assignee_id_idx, projects_workspace_id_idx
```

Plus runtime guardrails, ordered "measure → adopt":

- `statement_timeout = '2s'` scoped to the search path (e.g. `SET LOCAL` in the transaction the
  service uses, or a dedicated pool setting) — protects the OLTP instance from pathological queries.
- GIN maintenance: rely on `fastupdate` + autovacuum; monitor index bloat; `REINDEX CONCURRENTLY`
  as routine ops if posting lists degrade.
- **If EXPLAIN at 1M shows cross-tenant GIN bitmap scan dominating:** adopt in this order —
  (1) semi-join resolve `project_id = ANY(...)` from the (cheap) projects lookup;
  (2) `btree_gin` composite `(project_id, search_vector)`; (3) trigger-denormalized
  `tasks.workspace_id` + GIN `(workspace_id, search_vector)`. All transactional, same-DB — the
  denormalization here is *not* the dual-write of B; it's the database keeping its own copies.
- `priority`/`title`/`dueDate` sorts use per-slice top-N sorts (no index); if p95 shows sort cost
  on a hot tenant, add a STORED generated `priority_rank smallint` + `(project_id, priority_rank, id DESC)`
  — deferred as speculative until measured.

### 5.6 Verification gates

Phase 1 §4.5 acceptance suite (all 8, incl. two-workspace cross-contamination test and full
cursor-walk no-gaps/no-dupes property test) **plus**:

- `EXPLAIN (ANALYZE, BUFFERS)` review against a seeded 100k-task workspace: plan must show
  scope-first filtering and top-N, no sequential `tasks` scan when `q` present.
- A load check simulating 100 concurrent searchers (e.g. `autocannon`/`k6`) asserting NFR-P.1
  before "done".

---

## 6. Consequences

**Positive:** one system of record remains the *only* authority for both content and permission;
search is transactionally fresh; zero new infra, cost, or vendors; the whole feature ships as
one query builder + one cursor codec + one index migration; every failure mode is a Postgres
failure mode the team already has to know.

**Negative / accepted (see §7 triggers for the ones that could turn):**

## 7. Accepted technical debt & risks

| # | Debt / risk | Severity | Mitigation / ladder | Accepted because |
|---|---|---|---|---|
| T1 | **Relevance ceiling**: no typo tolerance, no infix/partial-word matching, no synonyms, `ts_rank` ≪ BM25 | Medium | Ladder: `pg_trgm` + `FUSE`/TrigramSimilarity for partial words (v2, same DB) → ParadeDB `pg_search` (BM25 in PG, *if* hosting provider allows the extension) → §7 trigger for B | Phase 1 cut fuzzy to v2 (E3, v2 candidates); filters + sorts carry real disambiguation load in board UX |
| T2 | **English-only stem config** baked into the generated column; `café` ≠ `cafe` (no `unaccent`) | Low–Med | New migration: `unaccent` template or per-locale configs when multilingual tenants materialize | Current user base is English-first; migration is additive |
| T3 | **Search competes with OLTP on one instance** (shared CPU/pool) | Medium | `statement_timeout`, §5.5 index ladder, read replica for search-only queries at high QPS | NFR-P.1 target is workspace-bounded; replica is a config change, not a redesign |
| T4 | **E10 point-in-time relevance**: edited rows may move between pages | Low | Documented in API behavior; stable sorts unaffected; v2 export is an async job, not pages | Any engine has a worse version of this (sync lag) |
| T5 | **Raw-SQL coupling**: `search_vector` lives outside the Prisma schema; column renames can silently break search | Low | Typed row interfaces + the acceptance suite runs against real DB; CI `verify` gate | The alternative (pure-Prisma) can't express tsquery predicates anyway |
| T6 | **ts_headline CPU scales with `limit`** | Low | Bounded by `limit ≤ 100` + CTE pattern (§5.4) | R2 decided the cap *for exactly this reason* |
| T7 | **Legacy unscoped `GET /tasks` remains live** (existing defect, not introduced here) | High — but pre-existing | R6/Phase 1 open follow-up: deprecate/remove in same ship cycle; new endpoint is the documented sanctioned path | Out of this ADR's scope; shipping the scoped endpoint *reduces* exposure |
| T8 | **`authenticate` is a 501 stub** — hard blocker; this endpoint cannot ship before JWT lands | Blocker | Sequenced dependency, not solved here | Same in every option |
| T9 | **GIN write amplification** (STORED vector + posting lists on a mutation-heavy table) | Low–Med | Autovacuum/GIN-pending-list monitoring; `REINDEX CONCURRENTLY` runbook | Already the status quo of the shipped migration |

## Revisit triggers (any one reopens this ADR)

1. p95 > 300 ms at ~100k tasks/workspace **after** the §5.5 mitigation ladder has been applied and measured.
2. A single workspace approaches ~1M tasks, or total corpus approaches ~10M.
3. Relevance becomes a product surface: user-reported typo/partial-word failures that the §7 T1
   ladder (trigram → `pg_search`) cannot absorb, or non-English tenants become material.
4. Search scope grows to comments/attachments/files (cross-entity corpora) or becomes a
   faceted-analytics surface (heavy `COUNT`-style aggregation).
5. Any move toward B is mandated: prefer **Meilisearch as a pure recall accelerator in front of
   Postgres** (engine returns candidate ids; Postgres re-applies workspace scope + filters before
   rendering — leak severity becomes missing-results, not wrong-tenant-results), not as the
   authority for ACL. Algolia remains excluded on sovereignty grounds for tenant content.

---

**Summary:** The spec's two hardest requirements — structural workspace scoping and mapped
priority sort — are *relational* problems that PostgreSQL solves inside the one query that must
also paginate; the dual-write problem Option B introduces is exactly the class of silent,
tenant-visible failure D1/D3 forbid; the 1M horizon is met by a measured in-database mitigation
ladder at $0 marginal infrastructure and one data boundary. Ship Option A; keep §7's triggers
as the tripwires.
