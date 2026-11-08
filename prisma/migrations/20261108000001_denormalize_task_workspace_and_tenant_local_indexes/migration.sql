-- R3 remediation (security audit findings #3/#4) — index the ACTUAL access
-- path for GET /workspaces/:workspaceId/tasks/search.
--
-- The previous migration's (project_id, ...) composites cannot serve the
-- workspace-scoped query: the search has no project_id equality predicate
-- (scope rides the projects JOIN), so the planner fell back to Seq Scan +
-- top-N sort on every page, and the GIN vector match was global
-- (cross-tenant posting lists). Fix per the Phase 2 §5.5 ladder, step (3):
-- denormalize workspace_id onto tasks — transactional, same-DB trigger,
-- NOT the external dual-write Option B rejected in the ADR — plus a
-- STORED generated priority_rank so the semantic priority sort is index
-- backed, and a tenant-local GIN (workspace_id, search_vector).

-- 1. workspace_id, backfilled from projects, then enforced.
ALTER TABLE "tasks" ADD COLUMN "workspace_id" UUID;

UPDATE "tasks" t
   SET workspace_id = p.workspace_id
  FROM "projects" p
 WHERE p.id = t.project_id;

ALTER TABLE "tasks" ALTER COLUMN "workspace_id" SET NOT NULL;

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
  ON UPDATE CASCADE ON DELETE CASCADE;

-- 2. Trigger keeps workspace_id in step with project_id (INSERT and any
-- project move). The column stays OUT of the Prisma model (like
-- search_vector): every write path — including prisma.task.createMany and
-- legacy routes — gets the correct value from the single DB authority.
CREATE OR REPLACE FUNCTION "tasks_sync_workspace_id"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.project_id IS DISTINCT FROM OLD.project_id THEN
    SELECT p.workspace_id INTO NEW.workspace_id
      FROM "projects" p
     WHERE p.id = NEW.project_id;

    IF NEW.workspace_id IS NULL THEN
      RAISE EXCEPTION 'task references unknown project %', NEW.project_id;
    END IF;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER "tasks_workspace_id_sync"
  BEFORE INSERT OR UPDATE ON "tasks"
  FOR EACH ROW EXECUTE FUNCTION "tasks_sync_workspace_id"();

-- 3. priority_rank: byte-for-byte the search CASE mapping (E11/E12), so
-- priority pages are index range scans instead of per-row CASE + sort.
-- Unknown stored values → 0 → deterministic.
ALTER TABLE "tasks" ADD COLUMN "priority_rank" SMALLINT
  GENERATED ALWAYS AS (
    CASE "priority"
      WHEN 'low' THEN 1
      WHEN 'medium' THEN 2
      WHEN 'high' THEN 3
      WHEN 'urgent' THEN 4
      ELSE 0
    END
  ) STORED;

-- 4. Index-backed sort paths, mirroring the endpoint's ORDER BY
-- (<sortKey> DESC, id ASC) for the DEFAULT and heaviest sort keys.
CREATE INDEX "tasks_workspace_created_idx"
  ON "tasks" ("workspace_id", "created_at" DESC, "id" ASC);

CREATE INDEX "tasks_workspace_updated_idx"
  ON "tasks" ("workspace_id", "updated_at" DESC, "id" ASC);

CREATE INDEX "tasks_workspace_priority_idx"
  ON "tasks" ("workspace_id", "priority_rank" DESC, "id" ASC);

CREATE INDEX "tasks_workspace_due_desc_idx"
  ON "tasks" ("workspace_id", COALESCE("due_date", '-infinity'::timestamptz) DESC, "id" ASC);

-- 5. Tenant-local GIN (ADR ladder step (2)/(3)): the FTS bitmap is now
-- bounded by one workspace's posting list prefix, not the whole table.
CREATE EXTENSION IF NOT EXISTS btree_gin;

CREATE INDEX "tasks_workspace_search_idx"
  ON "tasks" USING GIN ("workspace_id", "search_vector");

-- The (project_id, created_at/updated_at) composites from the previous
-- migration are KEPT: they now serve the projectId-filtered page case
-- (equality on the leading column via ?projectId=). Justified by audit
-- finding #3's own carve-out; drop only if write amplification shows up
-- in pg_stat_user_indexes.
--
-- OPERATIONS NOTE (audit #6, index builds): Prisma runs migrations inside a
-- transaction, which forbids CREATE INDEX CONCURRENTLY. On a 1M+ row
-- production table, run steps 4–5 as a separate maintenance window with
-- CONCURRENTLY instead of `migrate deploy` (then mark the migration applied
-- manually), or accept the build-time lock for the window.
