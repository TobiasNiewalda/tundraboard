# Task 02 — Extended thinking

**Task:** Planning / multi-file refactor — introduce `deleted_at` soft deletion across Task, Project, and Label without breaking existing queries.
**Model:** Claude Sonnet 5, high reasoning effort
**Wall-clock latency:** 44 seconds

## Prompt

> Task: Planning / multi-file refactor — plan how to introduce deleted_at soft deletion across TundraBoard's Task, Project, and Label models without breaking existing queries.
>
> Inspect the repository's Prisma schema, API routes, services, validation, tests, and migrations. Return a staged migration and deployment plan that identifies affected files and call sites, query changes, uniqueness and relation implications, backwards compatibility, rollback, testing, and operational risks. Do not modify files, execute commands, or delegate work. State assumptions only when the repository does not establish the needed behaviour. Limit the response to 450 words.

## LLM response

## Soft-Delete (`deleted_at`) Rollout Plan — Task, Project, Label

**Current state (from inspection):** `prisma/schema.prisma` defines `Task`, `Project`, `Label` with hard `onDelete: Cascade`/`SetNull` relations and only one migration (`20260818102854_init`). Routes in `src/routes/{tasks,projects,labels}.ts` are unimplemented TODO stubs (no Prisma calls exist yet), there's no `services/` or `validation/` layer, and `tests/` only contains `health.test.ts`. So there are no existing live queries to break today — this plan covers the schema/infra foundation plus the conventions the (not-yet-written) CRUD code must follow.

**1. Schema migration (additive, non-breaking)**
Add `deletedAt DateTime? @map("deleted_at") @db.Timestamptz` to `Task`, `Project`, `Label`. Add `@@index([deletedAt])` (or composite `[projectId, deletedAt]` / `[workspaceId, deletedAt]`) for filtered-list performance. Column is nullable with no default — existing rows become `NULL` (active) automatically; no backfill script needed.

**2. Uniqueness implications**
`Label` has `@@unique([workspaceId, name])`. Soft-deleting a label keeps the row, so recreating a same-named label in that workspace will violate uniqueness. Options: (a) change to a partial unique index `WHERE deleted_at IS NULL` via a manual `migration.sql` edit (Prisma doesn't natively support partial unique constraints, so this needs `prisma migrate dev --create-only` + hand-edited SQL), or (b) append a suffix/timestamp to `name` on delete. Assumption: option (a) preferred since no reservation-of-name convention exists yet.

**3. Relation/cascade implications**
`Task.onDelete: Cascade` from `Project`, and `TaskLabel`/`Comment`/`Attachment` cascade from `Task` — hard deletes still cascade at the DB level, so soft-deleting a `Project` does **not** automatically soft-delete its `Task`s. Plan must decide and document cascading soft-delete (recommend: application-layer cascade — when a `Project` is soft-deleted, set `deletedAt` on all non-deleted child `Task`s in the same transaction; leave `Comment`/`Attachment`/`TaskLabel` untouched since they have no `deletedAt` field and aren't in scope).

**4. Call-site/query changes (for the code to be written)**
All `findMany`/`findFirst`/`count` on these three models must add `deletedAt: null` (or a shared Prisma extension/middleware injecting the filter, since there's no service layer to centralize it yet). `findUnique` by id must be followed by a manual `deletedAt` check (Prisma `findUnique` can't take non-unique filters). DELETE endpoints become `UPDATE ... SET deleted_at = now()` instead of `prisma.*.delete`.

**5. Backwards compatibility / rollback**
Additive column + partial index is safely reversible: rollback migration drops the column/index; no data loss since hard-delete semantics are unaffected until routes adopt the filter. Rollback of query changes is a code revert only.

**6. Testing**
Add Prisma-level tests for soft-delete filtering, uniqueness-after-delete, and cascade behavior once CRUD routes exist; extend `tests/` beyond `health.test.ts`.

**7. Operational risks**
Unbounded growth of soft-deleted rows (no retention/purge job exists); missed filter in any new query path silently leaks deleted records — mitigate via a shared Prisma query extension rather than per-route filters.
