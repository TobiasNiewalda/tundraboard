# Task 02 — Fast generation

**Task:** Planning / multi-file refactor — introduce `deleted_at` soft deletion across Task, Project, and Label without breaking existing queries.
**Model:** Claude Sonnet 5, low reasoning effort
**Wall-clock latency:** 39 seconds

## Prompt

> Task: Planning / multi-file refactor — plan how to introduce deleted_at soft deletion across TundraBoard's Task, Project, and Label models without breaking existing queries.
>
> Inspect the repository's Prisma schema, API routes, services, validation, tests, and migrations. Return a staged migration and deployment plan that identifies affected files and call sites, query changes, uniqueness and relation implications, backwards compatibility, rollback, testing, and operational risks. Do not modify files, execute commands, or delegate work. State assumptions only when the repository does not establish the needed behaviour. Limit the response to 450 words.

## LLM response

Good — routes are unimplemented specs. This confirms scope: only schema, seed, and future implementations affected. I have enough context to produce the plan.

## Soft-Deletion Plan: Task, Project, Label (deleted_at)

**Current state:** Routes (`tasks.ts`, `projects.ts`, `labels.ts`) are unimplemented TODO stubs — no live Prisma queries to migrate. Only `prisma/seed.ts` and `prisma/schema.prisma` contain real DB calls today. This significantly reduces call-site risk but means the plan must also guide the *not-yet-written* route implementations.

**Schema changes** (`prisma/schema.prisma`): add `deletedAt DateTime? @map("deleted_at") @db.Timestamptz` to `Task`, `Project`, `Label`. Add `@@index([deletedAt])` on each for filtered-scan performance.

**Uniqueness/relation implications:**
- `Label` has `@@unique([workspaceId, name])`. A soft-deleted label still occupies that unique slot, blocking recreation of a same-named label. Options: (a) partial unique index `WHERE deleted_at IS NULL` (requires raw SQL migration, Prisma doesn't support partial unique natively — use `@@index` + manual SQL `CREATE UNIQUE INDEX ... WHERE deleted_at IS NULL`), or (b) keep constraint and require rename-on-delete. Recommend (a).
- Cascades: `onDelete: Cascade` (Project→Task, Task→Comment/TaskLabel/Attachment) only fires on hard delete. Soft-deleting a Project won't cascade-soft-delete its Tasks — application logic must explicitly cascade `deletedAt` to child Tasks (and Task→TaskLabel/Comments/Attachments if hiding children is desired), or accept orphaned "visible child under soft-deleted parent" and filter at query time via join checks.
- `TaskLabel` (join table) has no `deletedAt`; row cleanup on task/label soft-delete needs explicit handling (leave rows, filter via joined Task/Label deletedAt).

**Query changes:** every `findMany`/`findUnique`/`count` for Task/Project/Label must add `where: { deletedAt: null }`. Centralize via a Prisma extension (`$extends`) or repository helper (e.g., `activeTaskWhere()`) rather than repeating filters ad hoc in each future route — this is the highest-risk area for missed filters.

**Migration files:** new migration `add_deleted_at_soft_delete` — additive `ALTER TABLE ... ADD COLUMN deleted_at`, indexes, partial unique index replacing old unique constraint. Purely additive/non-breaking; no backfill needed (NULL default = "active").

**Staged rollout:**
1. Deploy migration (additive, safe, no app changes required simultaneously).
2. Deploy Prisma client regen + shared "active-only" query helpers/extension.
3. Implement route DELETE handlers to set `deletedAt: new Date()` instead of `prisma.*.delete()`; implement cascade logic for Project→Task.
4. Update `seed.ts` only if it needs deleted fixtures for testing.
5. Add tests validating filtered listing, cascade behavior, and unique-constraint recreation after soft delete.

**Backwards compatibility:** old hard-delete semantics disappear; any client depending on 404 GET-after-delete still works since queries filter `deletedAt`. Add an admin "restore" or hard-purge endpoint later if required (assumption).

**Rollback:** migration is additive — rollback = drop column/indexes; no data loss since nothing depended on it yet.

**Testing:** unit tests for the query helper, integration tests for cascade/orphan behavior, and a regression test confirming duplicate label names are only rejected among non-deleted labels.

**Operational risks:** missed `deletedAt: null` filters in ad hoc queries (mitigate via extension), unbounded growth of soft-deleted rows (assumption: add periodic purge job — not currently specified in repo).
