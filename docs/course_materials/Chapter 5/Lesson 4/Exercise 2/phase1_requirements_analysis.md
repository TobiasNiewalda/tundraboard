# Phase 1: Requirements Analysis — Advanced Task Search

**Endpoint:** `GET /workspaces/:workspaceId/tasks/search`
**Date:** November 8, 2026
**Status:** Approved (includes follow-up review deltas)
**Stack:** TypeScript / Express / Prisma / PostgreSQL

---

## 1. Domain Analysis

Analysis grounded in `prisma/schema.prisma`, `src/services/taskService.ts`, `src/routes/tasks.ts`, `src/middleware/authenticate.ts`, and `prisma/migrations/`.

### 1.1 The Task model (`tasks` table)

| Field | Type | Searchable | Filterable | Sortable | Notes |
|---|---|---|---|---|---|
| `title` | `VarChar(200)` | ✅ FTS, weight **A** | via `q` | ✅ | |
| `description` | `Text`, nullable | ✅ FTS, weight **B** | via `q` | ❌ | nullable — `COALESCE` already handled in the generated column |
| `status` | `VarChar(20)` | ❌ | ✅ required | possible | `todo \| in_progress \| done \| cancelled`; app-enforced enum, no DB type |
| `priority` | `VarChar(20)` | ❌ | ✅ required | ⚠️ | lexicographic sort is wrong; requires explicit rank mapping |
| `assigneeId` | `Uuid?`, nullable | ❌ | ✅ required | ❌ | `SetNull` on user delete → "unassigned" is a first-class filter state |
| `projectId` | `Uuid` | ❌ | ✅ (added in review) | ❌ | the *only* path from task to workspace |
| `dueDate` | `Timestamptz?` | ❌ | (v2 candidate) | ✅ | nullable → NULLS handling matters for cursors |
| `estimatedHours` | `Int?` | ❌ | (out of scope) | ✅ | |
| `createdAt` / `updatedAt` | `Timestamptz` | ❌ | ❌ | ✅ | `createdAt` desc is the natural default |
| `id` | `Uuid` | ❌ | ❌ | ✅ | unique → perfect deterministic tiebreaker |

### 1.2 Structural findings

1. **`tasks` has no `workspaceId` column.** Workspace scope exists only via `Task.projectId → Project.workspaceId`. Every search query must join or subquery through `projects`; any query on `tasks` alone is by construction a cross-workspace leak. TundraBoard is multi-tenant (`WorkspaceMember` exists because users from different orgs share the database).
2. **FTS infrastructure already exists** (`20261020000000_add_full_text_search`):
   - `search_vector tsvector GENERATED ALWAYS AS (...) STORED` — `title` weighted A, `description` weighted B, English config.
   - GIN index `tasks_search_vector_idx`.
   - `listTasks` already uses `websearch_to_tsquery('english', $q)` — operator-tolerant, never throws on junk input, produces AND-of-terms matching search-box expectations.
3. **Existing indexes on `tasks`:** `project_id`, `assignee_id`, `status`, `estimated_hours`, plus the GIN vector index. No composite sort indexes yet.
4. **Membership model:** `WorkspaceMember` with `@@unique([userId, workspaceId])`, roles `admin | member | viewer`. Membership check is a single lookup. Search is read-only → all roles may search.
5. **Conventions to respect:** Zod validation at the route layer, error envelope `{ "error": "..." }`, routers mounted flat in `app.ts`, `Prisma.sql` tagged templates for parameterized raw SQL, service functions in `services/taskService.ts`.
6. **Precondition:** `authenticate.ts` is a 501 stub. JWT auth must land before this endpoint ships.

---

## 2. Edge Case Discovery

| # | Edge case | Decision |
|---|---|---|
| E1 | Workspace leak via missing scope on the current `GET /tasks` | Endpoint is workspace-addressed (`/workspaces/:workspaceId/tasks/search`) so scope is structural, not an optional filter |
| E2 | "Not a member" vs "workspace doesn't exist" enumeration | Both return **404**, indistinguishably; membership verified *before* any search query |
| E3 | Case sensitivity | Handled by `to_tsvector`/`websearch_to_tsquery` (lowercase + stem). The existing tsvector path is the *only* sanctioned search path; `ILIKE` fallback explicitly out of scope |
| E4 | Empty / whitespace / punctuation-only `q` | `websearch_to_tsquery('')` matches **nothing**. Rule: trim `q`; if empty after trim (incl. operator-junk reducing to empty) → treated as *absent* (pure filter/sort mode), never as "match zero rows" |
| E5 | `q` matches nothing | `200` with `tasks: []` — never a 404 or 500 |
| E6 | Sort instability breaks pagination | `ts_rank` ties are common; `createdAt` ties on bulk imports. Every sort appends `id` tiebreaker → total order → no skipped/duplicated rows across pages |
| E7 | NULL sort values (`dueDate`, `estimatedHours`) | Postgres flips null position with direction (`NULLS LAST` ASC, `NULLS FIRST` DESC by default). Spec fixes `NULLS LAST` for **both** directions, mirrored in `ORDER BY` *and* the cursor predicate |
| E8 | Cursor must encode the full sort tuple | Keyset predicate must mirror `ORDER BY` exactly: `(v < $cv OR (v = $cv AND id < $cid))`. Cursor = base64 `{sortBy, sortOrder, v, id}`. Cursor is authoritative on page 2+; `sortBy` disagreement with the query string → **400** |
| E9 | Cursor tampering | Cursor is client-controlled input adjacent to raw SQL. Decode → strict Zod parse → `Prisma.sql` parameterization. Malformed → **400**, never 500, never SQL interpolation |
| E10 | `ts_rank` is computed and mutable | Rows edited mid-pagination can move between pages. Accepted for search (point-in-time semantics); stable sorts (`createdAt` etc.) unaffected |
| E11 | `priority` lexicographic sort garbage | `CASE` rank mapping: `low=1, medium=2, high=3, urgent=4` |
| E12 | Enums are app-enforced, not DB-enforced | Invalid *stored* values (via webhooks etc.) must never 500 the search. Filters are `IN` lists → unknown values simply don't match. Input validated by Zod |
| E13 | Assignee filter semantics | `assigneeId` accepts UUID, literal `me` (→ `req.user.id`), or literal `unassigned` (`assignee_id IS NULL`). Foreign-workspace UUID matches nothing (no leak) |
| E14 | `q` combined with explicit sort | Current `listTasks` hardcodes rank order and drops `sortBy`. New rule: `sortBy=relevance` only valid **with** `q` (else 400); `q` + `sortBy=createdAt` = "text filter, recency sort" |
| E15 | Offset pagination degrades and duplicates under concurrent inserts | Keyset (cursor) pagination only; every page O(limit), depth-independent |
| E16 | Result DTO is all bare IDs | Embed `project { id, title }` and `assignee { id, displayName }` — no N+1 |
| E17 | Auth stub | `authenticate` returns 501 today; endpoint depends on JWT auth + membership middleware (see NFR-M.3) |

### 2.1 Review deltas (post-first-draft)

- **R1 — `projectId` filter added.** Matches workspace→project→task hierarchy; rides the existing `project_id` index. **Foreign or invalid projectId → 400**, not a silent empty result (Option A: explicit validation against `:workspaceId` before the main query).
- **R2 — `limit` default 25 / max 100 justified.** Default = UX + payload (~15 KB/page enriched). Max = CPU bound: `ts_headline()` re-parses title AND description per returned row; 100 keeps us inside NFR-P.1. Over-fetch `limit + 1` derives `hasMore` with no `COUNT(*)`.
- **R3 — Workspace restriction confirmed mandatory** (NFR-S.1). Enforced in SQL `WHERE` via `project.workspace_id`, never post-filtered in JS (post-filtering breaks pagination math and still pulls other tenants' rows). Acceptance test: two seeded workspaces, assert zero cross-contamination.
- **R4 — Error contract fixed to {200, 400, 401, 404, 429, 500}.** 429 added (rate limiting was already spec'd); 403 deliberately absent (workspace enumeration via 404); 422 rejected (Zod + repo convention = 400); 502/503/504 map to 500 (details to logs only).
- **R5 — `ts_headline()` snippets confirmed.** See FR-1.5; snippets HTML-escaped server-side.
- **R6 — `requireWorkspaceMember` middleware confirmed** (NFR-M.3), shared with future `GET /workspaces/:id`.
- **Open follow-up:** deprecate/remove the unscoped legacy `GET /tasks` in the same cycle (currently a live security exception).

---

## 3. Requirements

### 3.1 Functional Requirements

#### Search (FR-1)

- **FR-1.1** — Full-text search SHALL match `title` (weight A) and `description` (weight B) via the existing `search_vector` generated column, English config.
- **FR-1.2** — The query SHALL be parsed with `websearch_to_tsquery` (operator-tolerant, AND-of-terms).
- **FR-1.3** — `q` SHALL be trimmed; empty/whitespace/punctuation-only input SHALL be treated as *no search* (filters/sort still apply), never "match nothing".
- **FR-1.4** — A `q` matching nothing SHALL return `200` with `tasks: []`.
- **FR-1.5** *(added in review)* — When `q` is present, each result SHALL include a `snippet` field generated via `ts_headline()` over title/description with the parsed query, highlighting matched terms. Snippets SHALL be HTML-escaped server-side before transport.

#### Filter (FR-2) — optional, composable (AND across filters, OR within a filter)

- **FR-2.1** — `status`: subset of `todo | in_progress | done | cancelled` (`IN` list).
- **FR-2.2** — `priority`: subset of `low | medium | high | urgent` (`IN` list).
- **FR-2.3** — `assigneeId`: UUID | `me` (→ authenticated user) | `unassigned` (`assignee_id IS NULL`).
- **FR-2.4** — Invalid filter values SHALL be rejected with `400` before any DB access.
- **FR-2.5** — Filters SHALL be composable with `q` and with each other.
- **FR-2.6** *(added in review)* — `projectId`: one or more UUIDs; each MUST belong to `:workspaceId`, else **400** (validated before the main query).

#### Sort (FR-3)

- **FR-3.1** — Sort keys: `relevance | createdAt | updatedAt | dueDate | priority | title`. Default: `createdAt` desc.
- **FR-3.2** — `relevance` SHALL require `q` (`400` otherwise). `q` present + no `sortBy` → default `relevance` desc.
- **FR-3.3** — `priority` SHALL sort by urgency rank (`low=1 → urgent=4`), never lexicographically.
- **FR-3.4** — **Stability:** every sort SHALL append `id` as final tiebreaker (`ORDER BY <key> <dir> NULLS LAST, id <dir>`) → total order.
- **FR-3.5** — NULLs SHALL sort last in **both** directions (`NULLS LAST`), consistently in `ORDER BY` and the cursor predicate.

#### Pagination (FR-4) — cursor-based (keyset), never offset

- **FR-4.1** — `limit`: 1–100, default 25. Server fetches `limit + 1` to derive `hasMore`/`nextCursor`; no `COUNT(*)`.
- **FR-4.2** — Cursor SHALL be an opaque base64 token encoding `{ sortBy, sortOrder, v, id }`; strictly Zod-validated and parameterized into SQL. Malformed/tampered → `400`.
- **FR-4.3** — On subsequent pages the cursor is authoritative for sort; cursor/query-string sort disagreement → `400`.
- **FR-4.4** — Keyset predicate SHALL mirror the exact `ORDER BY`, including NULLS handling: `(v < $cv OR (v = $cv AND id < $cid))` for `desc`, inverted for `asc`.
- **FR-4.5** — `nextCursor: null` + `hasMore: false` marks the last page; a cursor replayed on the last page → `200`, empty `tasks`.

### 3.2 Non-Functional Requirements

#### Security (NFR-S) — highest priority

- **NFR-S.1** — **Every result SHALL be scoped to `:workspaceId`** via `project.workspace_id`, applied in the SQL `WHERE` clause before pagination. No code path may query `tasks` unscoped.
- **NFR-S.2** — Requires JWT auth (`401`) and a verified `WorkspaceMember(userId, workspaceId)` record (`404` for not-found **or** non-member, indistinguishable). All roles (`admin | member | viewer`) may search.
- **NFR-S.3** — Membership check SHALL precede the search query; no existence side channel.
- **NFR-S.4** — All raw SQL SHALL use `Prisma.sql`/`$queryRaw` parameterization; all inputs (incl. decoded cursor) Zod-validated first. No `QueryRawUnsafe`.
- **NFR-S.5** — Errors SHALL NOT echo SQL or stack traces (`{ "error": "..." }` envelope).
- **NFR-S.6** — Per-user rate limit: 60 req/min, enforced with `429` + `Retry-After`. No per-read audit rows; aggregate metrics only.

#### Performance (NFR-P)

- **NFR-P.1** — p95 ≤ 300 ms, p99 ≤ 1 s at 100k tasks/workspace, 100 concurrent searchers. Keyset pagination keeps every page O(limit).
- **NFR-P.2** — Use existing GIN `tasks_search_vector_idx` for `q`; existing `project_id`/`status`/`assignee_id` btrees for filters. **New migration:** composite indexes `tasks(project_id, created_at DESC, id DESC)` and `tasks(project_id, updated_at DESC, id DESC)`.
- **NFR-P.3** — No `COUNT(*)` on the search path; `hasMore` from the `limit + 1` over-fetch.
- **NFR-P.4** — Embedded relation scalars (`project.title`, `assignee.displayName`) via join/include — no N+1.
- **NFR-P.5** — Shared `prisma` client; no per-request connections.

#### Compatibility / Maintainability (NFR-M)

- **NFR-M.1** — Repo conventions: Express router + Zod at route layer, service function in `taskService.ts`, `{ error: string }` envelope.
- **NFR-M.2** — Legacy `GET /tasks` stays untouched this cycle, with a documented deprecation note pointing to the new endpoint.
- **NFR-M.3** *(added in review)* — Reusable `requireWorkspaceMember` middleware: JWT → verify membership → attach `{ userId, role }` to `req`, else `401` (no JWT) / `404` (no membership). Mounted here and on future workspace-scoped endpoints so membership semantics cannot drift.

#### Error contract (final)

| Status | When |
|---|---|
| `200` | Success (including empty results) |
| `400` | Zod failure; malformed cursor; sort/cursor conflict; `relevance` without `q`; `projectId` not in workspace |
| `401` | Missing/invalid JWT |
| `404` | Workspace not found **or** caller not a member (deliberately indistinguishable) |
| `429` | Rate limit exceeded (with `Retry-After`) |
| `500` | Unexpected DB/internal failure (generic message; details to logs) |

Anything outside this set escaping the endpoint is a bug in the error handler, not documented behavior.

---

## 4. API Specification

**Route:** `GET /workspaces/:workspaceId/tasks/search`

### 4.1 Request — query parameters

| Param | Type | Default | Notes |
|---|---|---|---|
| `q` | string | — | Trimmed; empty ⇒ ignored (FR-1.3) |
| `status` | csv / repeated | — | `todo,in_progress,done,cancelled` |
| `priority` | csv / repeated | — | `low,medium,high,urgent` |
| `assigneeId` | uuid \| `me` \| `unassigned` | — | FR-2.3 |
| `projectId` | csv / repeated | — | Must belong to `:workspaceId` (FR-2.6) |
| `sortBy` | enum | `createdAt` | `relevance` requires `q` |
| `sortOrder` | `asc` \| `desc` | `desc` | |
| `limit` | int 1–100 | `25` | FR-4.1 |
| `cursor` | string (base64) | — | Opaque keyset token |

### 4.2 Zod schemas (route layer)

```ts
const searchQuerySchema = z.object({
  q: z.string().optional(),
  status: csvList(z.enum(["todo", "in_progress", "done", "cancelled"])).optional(),
  priority: csvList(z.enum(["low", "medium", "high", "urgent"])).optional(),
  assigneeId: z
    .union([z.string().uuid(), z.literal("me"), z.literal("unassigned")])
    .optional(),
  projectId: csvList(z.string().uuid()).optional(),
  sortBy: z
    .enum(["relevance", "createdAt", "updatedAt", "dueDate", "priority", "title"])
    .optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional(),
});

const cursorSchema = z.object({
  sortBy: searchQuerySchema.shape.sortBy,
  sortOrder: z.enum(["asc", "desc"]),
  v: z.union([z.number(), z.string(), z.null()]).nullable(), // rank, ISO date, or priority rank
  id: z.string().uuid(),
});
```

### 4.3 Success response — `200`

```jsonc
{
  "tasks": [
    {
      "id": "b1c3e6d2-…",
      "projectId": "7ad2f4a1-…",
      "project": { "id": "7ad2f4a1-…", "title": "Q4 Launch" },
      "title": "Fix login redirect loop",
      "description": "OAuth callback drops the state param…",
      "snippet": "…drops the <b>state</b> param…",       // null when q absent
      "status": "in_progress",
      "priority": "high",
      "assignee": { "id": "9ce4…", "displayName": "Tobias N." }, // null when unassigned
      "createdById": "9ce4…",
      "dueDate": "2026-11-15T00:00:00Z",
      "estimatedHours": 4,
      "createdAt": "2026-11-01T09:12:00Z",
      "updatedAt": "2026-11-07T16:40:00Z"
    }
  ],
  "nextCursor": "eyJzb3J0QnkiOiJjcmVhdGVkQXQi…",  // null on last page
  "hasMore": true
}
```

- `TaskSearchResult` = flat `Task` fields + embedded `project` / `assignee` + `snippet` (E16, FR-1.5).
- Comments/labels/attachments are **not** included — `GET /tasks/:id` remains the detail path.
- `nextCursor` is returned only when `hasMore === true`; the client replays it verbatim.

### 4.4 Reference query shape (illustrative; parameterized via `Prisma.$queryRaw`)

```sql
SELECT t.*, p.title AS project_title,
       ts_rank(t.search_vector, websearch_to_tsquery('english', $q)) AS rank,
       ts_headline(
         coalesce(t.title, '') || ' ' || coalesce(t.description, ''),
         websearch_to_tsquery('english', $q)
       ) AS snippet
FROM tasks t
JOIN projects p ON p.id = t.project_id
WHERE p.workspace_id = $workspaceId                      -- NFR-S.1 (mandatory)
  AND ($projectIds IS NULL OR t.project_id = ANY($projectIds))
  AND ($statuses   IS NULL OR t.status = ANY($statuses))
  AND ($priorities IS NULL OR t.priority = ANY($priorities))
  AND ($assignee IS NULL OR t.assignee_id = $assignee)    -- 'unassigned' ⇒ t.assignee_id IS NULL
  AND ($q IS NULL OR t.search_vector @@ websearch_to_tsquery('english', $q))
  -- keyset predicate, mirrors ORDER BY incl. NULLS handling (FR-4.4)
  AND ($cursorV IS NULL OR (<sortExpr>, t.id) < ($cursorV, $cursorId))
ORDER BY <sortExpr> $dir NULLS LAST, t.id $dir
LIMIT $limit + 1;
```

### 4.5 Acceptance criteria (minimum test set)

1. **Cross-workspace isolation:** two seeded workspaces; a search in A returns zero rows from B (NFR-S.1).
2. **Non-member invisibility:** non-member and unknown-workspace requests both return `404` with identical bodies.
3. **Empty `q`:** `q="   "` behaves as absent (filters/sorts still apply).
4. **Sort stability:** page walk over a dataset with duplicate sort keys yields no duplicates and no gaps (tiebreaker proof).
5. **Cursor integrity:** tampered/garbage cursor → `400`; sort-change mid-walk → `400`.
6. **Priority ordering:** `urgent > high > medium > low` regardless of alphabet.
7. **Pagination math:** `limit + 1` over-fetch → `hasMore`/`nextCursor` correct at page boundaries and on the final (empty-after-cursor) page.
8. **Snippet escaping:** markup in `description` is HTML-escaped in `snippet`.

---

## 5. Implementation Risks & Open Items

- **Blocker:** `authenticate` middleware is a 501 stub — endpoint cannot ship until JWT auth is implemented.
- **Live defect:** legacy `GET /tasks` is unauthenticated and unscoped; recommend deprecating/removing it in the same cycle as this endpoint ships.
- **Migration required:** composite indexes per NFR-P.2; no schema (model) changes needed — `search_vector` already exists.
- **v2 candidates (out of scope):** `dueDate` range filters; trigram/`ILIKE` fallback for partial-word matching; export matching tasks as an async job (never `limit=10000`).