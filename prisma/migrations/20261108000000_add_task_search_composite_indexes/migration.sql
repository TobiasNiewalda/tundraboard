-- Composite indexes supporting keyset (cursor) pagination for
-- GET /workspaces/:workspaceId/tasks/search (Phase 1 NFR-P.2, Phase 2 §5.5).
--
-- The search query scopes by workspace via tasks.project_id (JOIN projects),
-- then sorts (<sortKey> DESC NULLS LAST, id ASC) and fetches limit + 1 rows.
-- These btree indexes keep every page O(limit), independent of pagination
-- depth. (Plain CREATE INDEX: Prisma runs migrations in a transaction, which
-- disallows CONCURRENTLY; the table is small enough for a locking build.)

CREATE INDEX "tasks_project_created_idx" ON "tasks" ("project_id", "created_at" DESC, "id" ASC);

CREATE INDEX "tasks_project_updated_idx" ON "tasks" ("project_id", "updated_at" DESC, "id" ASC);
