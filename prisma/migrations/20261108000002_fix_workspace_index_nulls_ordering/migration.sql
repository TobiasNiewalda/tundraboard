-- Follow-up to 20261108000001 (verified via EXPLAIN on a 20-workspace /
-- 42k-task corpus): CREATE INDEX "… DESC" defaults to NULLS FIRST, but the
-- search's ORDER BY is "<key> DESC NULLS LAST, id ASC" (FR-3.5 + the id ASC
-- tiebreaker constraint). Postgres pathkey matching treats the NULLS
-- ordering as part of the key, so with the defaults NO ordered index path
-- exists for the page sort — the planner used the indexes only as bitmap
-- filters and still sorted per page. Rebuild the workspace indexes with the
-- exact NULLS ordering so a page is a bounded ordered index scan
-- (audit finding #3 closed end-to-end).

DROP INDEX IF EXISTS "tasks_workspace_created_idx";
CREATE INDEX "tasks_workspace_created_idx"
  ON "tasks" ("workspace_id", "created_at" DESC NULLS LAST, "id" ASC);

DROP INDEX IF EXISTS "tasks_workspace_updated_idx";
CREATE INDEX "tasks_workspace_updated_idx"
  ON "tasks" ("workspace_id", "updated_at" DESC NULLS LAST, "id" ASC);

DROP INDEX IF EXISTS "tasks_workspace_priority_idx";
CREATE INDEX "tasks_workspace_priority_idx"
  ON "tasks" ("workspace_id", "priority_rank" DESC NULLS LAST, "id" ASC);

DROP INDEX IF EXISTS "tasks_workspace_due_desc_idx";
CREATE INDEX "tasks_workspace_due_desc_idx"
  ON "tasks" ("workspace_id", COALESCE("due_date", '-infinity'::timestamptz) DESC NULLS LAST, "id" ASC);
