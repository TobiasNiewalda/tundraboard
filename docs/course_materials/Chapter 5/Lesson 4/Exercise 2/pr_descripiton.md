# feat(tasks): Advanced Task Search endpoint + security audit remediation

**Covers:** `phase1_requirements_analysis.md` / `phase2_architecture_adr.md` (Exercise 2), security audit remediation #1–#4, and the second-opinion review findings (B1/B2/B3/C1/C4).

## Summary

New `GET /workspaces/:workspaceId/tasks/search` — Postgres FTS over `search_vector`, multi-value filters, semantic priority sort, and HMAC-signed, workspace-bound cursor (keyset) pagination — plus fixes for the system-level defects the audit found *around* it: an unauthenticated legacy `/tasks` router, a JWT stub, and index plans that could not serve the queries they were named for.

```text
src/
├── middleware/
│   ├── authenticate.ts              # HS256 JWT verification (fail-closed); exports signAuthToken for /auth/login
│   ├── requireWorkspaceMember.ts    # membership lookup helper + middleware (indistinguishable 404, E2)
│   └── rateLimit.ts                 # per-user sliding-window limiter (60/min → 429 + Retry-After)
├── services/taskService.ts          # searchTasks (page-CTE, raw SQL) + workspace scope on ALL legacy functions
├── utils/taskSearchCursor.ts        # base64url + HMAC-SHA256 signed cursor { sortBy, sortOrder, v, id, ws }
└── routes/tasks.ts                  # workspaceTaskSearchRouter + legacy router now behind auth + ?workspaceId

prisma/migrations/
├── …000000_add_task_search_composite_indexes      # (project_id, …) composites (projectId-filtered pages)
├── …000001_denormalize_task_workspace_and_…       # tasks.workspace_id (trigger) + generated priority_rank + tenant-local GIN
└── …000002_fix_workspace_index_nulls_ordering     # DESC NULLS LAST — pathkey match for the ORDER BY
```

Search request pipeline:

```text
GET /workspaces/:workspaceId/tasks/search
  authenticate                       → 401 no/invalid/expired JWT · 501 server misconfigured (no JWT_SECRET)
  requireWorkspaceMember             → 404 non-member ≡ missing workspace (checked before any task query)
  searchRateLimiter                  → 429 + Retry-After (60 req/min per user)
  Zod (query)                        → 400 before DB (caps: q≤256, cursor≤1024, IN-lists≤20, limit 1–100)
  searchTasks                        → ONE transaction:
      set_config('statement_timeout', '2000', true)
      numnode preflight              → stopword/junk-only q reduces to "no search" (E4)
      projectId ownership check      → 400 on foreign project (FR-2.6), never a silent empty page
      WITH page AS (…)               → scope t.workspace_id, same sort fragment in SELECT/WHERE/ORDER BY
                                        (single source of truth), LIMIT n+1 (hasMore, no COUNT),
                                        ORDER BY <key> <dir> NULLS LAST, t.id ASC — no OFFSET anywhere
      hydrate ≤ n+1 rows             → project/assignee embeds (assignee display name membership-gated),
                                        ts_headline snippet (sentinel-scrubbed, HTML-escaped → <mark>)
```

## API

`GET /workspaces/:workspaceId/tasks/search` — JWT required; all roles (`admin | member | viewer`) may search (read-only).

| Param | Type | Default | Notes |
|---|---|---|---|
| `q` | string ≤256 | — | FTS over title (weight A) + description (B) via `websearch_to_tsquery`; trimmed; whitespace/stopword/operator-only ⇒ treated as absent, never "match nothing" |
| `status` | csv / repeated | — | `todo\|in_progress\|done\|cancelled`; OR within the filter, AND across filters |
| `priority` | csv / repeated | — | `low\|medium\|high\|urgent` |
| `assigneeId` | uuid \| `me` \| `unassigned` | — | `me` → JWT subject; `unassigned` → `assignee_id IS NULL` |
| `projectId` | csv uuids | — | every id MUST belong to `:workspaceId`, else 400 |
| `sortBy` | enum | `createdAt` — or `relevance` desc when `q` present | `relevance\|createdAt\|updatedAt\|dueDate\|priority\|title`; `relevance` without an effective `q` → 400 |
| `sortOrder` | `asc\|desc` | `desc` (or the cursor's) | when `sortBy` is omitted the cursor is authoritative (verbatim replay) |
| `limit` | int 1–100 | 25 | server over-fetches n+1 to derive `hasMore`; no `COUNT(*)` |
| `cursor` | opaque ≤1024 | — | HMAC-signed, workspace-bound; replay verbatim with the original filters |

`200` — canonical envelope:

```jsonc
{
  "data": [{
    "id": "…", "projectId": "…", "project": { "id": "…", "title": "Q4 Launch" },
    "title": "…", "description": "…", "snippet": "<mark>login</mark> redirect &lt;b&gt;", // null when q absent
    "status": "in_progress", "priority": "high",
    "assignee": { "id": "…", "displayName": "Tobias N." },   // null when unassigned / non-member
    "assigneeId": "…", "createdById": "…", "dueDate": "…", "estimatedHours": 4,
    "createdAt": "…", "updatedAt": "…"
  }],
  "pagination": { "nextCursor": "eyJ…", "hasMore": true }     // null/false on the last page
}
```

- `priority` sorts by urgency rank (`low=1 … urgent=4`, unknown stored values → 0), never lexicographically; the mapping is a DB generated column (`priority_rank`) so pages are index range scans.
- NULL `dueDate` sorts last in **both** directions (`±infinity` sentinels stay inside SQL; never on the wire).
- Replaying the final page's cursor yields `200` with `data: []` (FR-4.5).

Errors: `400` (validation · malformed/tampered/cross-workspace cursor · cursor/sort conflict · relevance-without-q · foreign projectId) · `401` (missing/invalid/expired JWT) · `404` (unknown workspace **≡** non-member, byte-identical body — enumeration-resistant) · `429` (+`Retry-After`) · `500` (generic `failed to search tasks`). Anything matching nothing is always `200` with an empty `data`.

**Breaking change — legacy `/tasks` router:** every route now requires a JWT and a membership-verified `?workspaceId=`; `POST /tasks` 400s on a cross-workspace `projectId`; responses carry `Deprecation: true`. Sanctioned successor: this endpoint (Phase 1 NFR-M.2).

## Evidence

- **Audit #1/#2 (CRITICAL):** *Before:* `GET /tasks?q=invoice` anonymously returned full-text search results across all tenants. *After:* **401** — pinned by `tests/tasks.test.ts` ("401s the anonymous cross-tenant FTS attack"), and auth guarantees now run against the **real** `authenticate` (no mocks): signed JWT passes; forged/expired → 401; missing `JWT_SECRET` → 501 fail-closed.
- **Audit #3/#4 (HIGH):** *Before:* `Seq Scan on tasks` + per-page Sort (whole heap, all tenants). *After:* `EXPLAIN (ANALYZE)` on a 42k-task/20-workspace corpus: default page = **`Index Only Scan using tasks_workspace_created_idx`, no Sort node, Heap Fetches: 0, 0.082 ms**; keyset page 0.188 ms; priority pages via `tasks_workspace_priority_idx`; broad FTS terms are workspace-bounded (no global cross-tenant GIN bitmap). The `NULLS LAST` pathkey fix (migration 2) was found only by forcing `enable_sort=off` — v1 indexes filtered but never ordered.
- **Second-opinion regressions pinned by tests:** asc keyset walks across 5-way duplicate-timestamp buckets over 118 rows; `dueDate` sorting with 111 NULL rows without 500-ing (±infinity is never projected to the client); µs-precision cursor round-trip (`"…00.123455Z"` via `to_char(… AT TIME ZONE 'UTC' …'US')`); `1e300` / year `-271821` cursors → 400, not 500; verbatim cursor replay continues the original sort. Cursor walks assert sequence-identity against an independent full-scan SQL oracle (no gaps, no duplicates).
- **Gates:** `tsc` ✅ · `eslint` ✅ · `prettier` ✅ · `vitest run --coverage` **95/95** (73 contract/legacy + 22 live-Postgres integration incl. cross-tenant canary with an identically titled task in WS2), coverage 86.8% lines / 79.9% branches / 89.9% functions (thresholds met). CI `test` job now provisions `postgres:16-alpine` + `prisma migrate deploy`, so DB-layer regressions fail the pipeline instead of self-skipping.

## Security posture — trade-offs accepted

| Guard | Cost accepted |
|---|---|
| Rate limit 60/min, **in-process** Map | bypassed by a second instance; idle keys swept every 1024 requests; swap to a shared store before multi-instance deploys |
| `statement_timeout` 2 s per search transaction | pathological-but-legal exports are cut — that is the point (OLTP protection, ADR §5.5) |
| Signed cursor (HMAC over `CURSOR_SECRET`/`JWT_SECRET`) | forge-proof and workspace-bound, but cursors break (400) across workspaces and after a secret rotation — clients restart at page 1 |
| Caps: `q` 256, `cursor` 1024, IN-lists 20 | a >256-char legitimate query 400s; raise deliberately if a real need appears |
| 404 indistinguishability | no "did you mean" help for mistyped ids — deliberate, kills enumeration |
| Assignee display name membership-gated | ex-employee assignees show raw `assigneeId` (DB truth) with `assignee: null` — no name leak via webhook-written rows |
| Snippet: scrub sentinels → HTML-escape → `<mark>` | user text containing `⟦⟧` loses its highlight rather than forging markup |

## Implementation gaps / known limitations

- **`/auth/login` issuer is still a TODO stub.** `authenticate` ships with a documented payload contract (`{ sub, email, displayName }`, HS256) and exports `signAuthToken` so issuer and verifier cannot drift; until `auth.ts` lands, only tooling-minted tokens exist. The endpoint is fail-closed (501) without `JWT_SECRET`.
- **Deep keyset pages traverse O(depth) index entries** within the workspace slice (keyset appears as `Filter`, not `Index Cond`) because the mandated `id ASC` tiebreaker makes the mixed-direction comparison inexpressible as one btree range. No cross-tenant work; the lever if deep-page latency ever matters is switching the tiebreaker to `id DESC` on desc sorts (changes the ORDER BY contract).
- **`sortOrder=asc` and `title` sorts have no leading index** — they top-N sort the workspace slice. Deliberate: asc pages are the minority, and index fan-out taxes a mutation-heavy table.
- **No `CREATE INDEX CONCURRENTLY`** (Prisma migrations are transactional): production at 1M+ rows should run the index steps as a maintenance window with CONCURRENTLY — runbook note lives in the migration SQL.
- **Legacy routes are authenticated + scoped but not rate-limited** (limiter is search-only, per NFR-S.6 scoping).
- **Process control not built:** the audit's suggested CI grep gate ("no client string inside a `Prisma.sql` template") is not implemented; the `SORT_EXPR` allowlist carries the invariant in comments instead.
- **Carried-over ADR debt (unchanged):** English-only stem config (T2), no typo/infix matching (T1 — v2 trigram ladder), point-in-time relevance under concurrent edits (E10/T4).

## Merge Danger

**Door: one-way (schema) + breaking (API).**

The `workspace_id NOT NULL` backfill, FK, trigger, and generated column are the expensive part to unwind: app-code rollback against the new schema is safe (the trigger populates rows old code writes), but rolling the *schema* back means dropping trigger/function/column and resetting migration records. Deploy **migrations before** app code — new code on the old schema fails loudly and immediately (good). The legacy `/tasks` contract change (auth + `?workspaceId=`) breaks any current consumer — deliberately, as those consumers were unauthenticated cross-tenant leaks.

**Blast Radius: the `tasks` write-path and every `/tasks` consumer.**

All task inserts/updates now flow through `tasks_workspace_id_sync`; the CI test job gains a Postgres service; every legacy task endpoint flips from open to 401-for-anonymous. The new search endpoint itself is purely additive.
