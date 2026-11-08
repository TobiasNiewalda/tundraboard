import { prisma } from "../utils/prisma.js";
import { Prisma } from "@prisma/client";

import { sendAssignmentEmail } from "./emailService.js";
import {
  encodeSearchCursor,
  type SearchCursorPayload,
  type TaskSearchSortBy,
  type TaskSearchSortOrder,
} from "../utils/taskSearchCursor.js";

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskLabel {
  id: string;
  workspaceId: string;
  name: string;
  colour: string;
  createdAt: Date;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string | null;
  createdById: string;
  dueDate: Date | null;
  estimatedHours: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskDetails extends Task {
  comments: TaskComment[];
  labels: TaskLabel[];
}

export interface CreateCommentInput {
  /** R2 remediation — task must live in this workspace. */
  workspaceId: string;
  taskId: string;
  authorId: string;
  content: string;
}

export interface CreateTaskInput {
  /**
   * R2 remediation (security audit finding #1): every legacy /tasks path
   * is now authenticated AND workspace-scoped. workspaceId must own the
   * given projectId.
   */
  workspaceId: string;
  projectId: string;
  title: string;
  description?: string | null;
  status?: string;
  priority?: string;
  assigneeId?: string | null;
  createdById: string;
  dueDate?: Date | null;
  estimatedHours?: number | null;
}

export interface ListTasksInput {
  /** R2 remediation — mandatory tenant scope (NFR-S.1 applies to ALL paths). */
  workspaceId: string;
  q?: string;
  estimatedHours?: number;
  sortBy?: "createdAt" | "estimatedHours";
  sortOrder?: "asc" | "desc";
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: string;
  priority?: string;
  assigneeId?: string | null;
  dueDate?: Date | null;
  estimatedHours?: number | null;
}

interface TaskWithRelations extends Task {
  comments: TaskComment[];
  taskLabels: Array<{
    label: TaskLabel;
  }>;
}

/**
 * R2 remediation — resolve a task ONLY inside the caller's workspace.
 * Out-of-scope and missing ids are indistinguishable ("Task not found" →
 * the route's 404), so the legacy paths leak nothing either (E2 pattern).
 */
async function findTaskInWorkspace(taskId: string, workspaceId: string) {
  return prisma.task.findFirst({
    where: { id: taskId, project: { workspaceId } },
    select: { id: true, assigneeId: true },
  });
}

export async function getTask(
  taskId: string,
  workspaceId: string,
): Promise<TaskDetails> {
  const task = (await prisma.task.findFirst({
    where: { id: taskId, project: { workspaceId } },
    include: {
      comments: true,
      taskLabels: {
        include: {
          label: true,
        },
      },
    },
  })) as TaskWithRelations | null;

  if (!task) {
    throw new Error("Task not found");
  }

  return toTaskDetails(task);
}

export async function getCommentsByTaskId(
  taskId: string,
  workspaceId: string,
): Promise<TaskComment[]> {
  const task = await findTaskInWorkspace(taskId, workspaceId);

  if (!task) {
    throw new Error("Task not found");
  }

  return prisma.comment.findMany({
    where: { taskId },
    orderBy: { createdAt: "asc" },
  });
}

export async function createComment(
  input: CreateCommentInput,
): Promise<TaskComment> {
  const task = await findTaskInWorkspace(input.taskId, input.workspaceId);

  if (!task) {
    throw new Error("Task not found");
  }

  return prisma.comment.create({
    data: {
      taskId: input.taskId,
      authorId: input.authorId,
      content: input.content,
    },
  });
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  // R2 remediation — a write path cannot target foreign tenants: the given
  // projectId must belong to the caller's workspace, or the whole request is
  // rejected. Same indistinguishable-error pattern as search's FR-2.6.
  const project = await prisma.project.findFirst({
    where: { id: input.projectId, workspaceId: input.workspaceId },
    select: { id: true },
  });

  if (!project) {
    throw new Error("Project not found in workspace");
  }

  return prisma.task.create({
    data: {
      projectId: input.projectId,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? "todo",
      priority: input.priority ?? "medium",
      assigneeId: input.assigneeId ?? null,
      createdById: input.createdById,
      dueDate: input.dueDate ?? null,
      estimatedHours: input.estimatedHours ?? null,
    },
  });
}

export async function listTasks(input: ListTasksInput): Promise<Task[]> {
  if (input.q) {
    const { q, workspaceId } = input;
    const tasks = await prisma.$queryRaw`
      SELECT 
        id, 
        project_id AS "projectId", 
        title, 
        description, 
        status, 
        priority, 
        assignee_id AS "assigneeId", 
        created_by_id AS "createdById", 
        due_date AS "dueDate", 
        estimated_hours AS "estimatedHours", 
        created_at AS "createdAt", 
        updated_at AS "updatedAt"
      FROM "tasks"
      WHERE workspace_id = ${workspaceId}::uuid
      AND search_vector @@ websearch_to_tsquery('english', ${q})
      ${input.estimatedHours !== undefined ? Prisma.sql`AND estimated_hours = ${input.estimatedHours}` : Prisma.empty}
      ORDER BY ts_rank(search_vector, websearch_to_tsquery('english', ${q})) DESC, id ASC
    `;
    return tasks as Task[];
  }

  return prisma.task.findMany({
    where: {
      project: { workspaceId: input.workspaceId },
      ...(input.estimatedHours !== undefined
        ? { estimatedHours: input.estimatedHours }
        : {}),
    },
    orderBy: input.sortBy
      ? { [input.sortBy]: input.sortOrder ?? "asc" }
      : { createdAt: "desc" },
  });
}

export async function updateTask(
  id: string,
  data: UpdateTaskInput,
  workspaceId: string,
): Promise<Task> {
  const existingTask = await findTaskInWorkspace(id, workspaceId);

  if (!existingTask) {
    throw new Error("Task not found");
  }

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...data,
      updatedAt: new Date(),
    },
  });

  if (data.assigneeId && data.assigneeId !== existingTask.assigneeId) {
    const assignee = await prisma.user.findUnique({
      where: { id: data.assigneeId },
      select: { email: true },
    });

    if (assignee?.email) {
      void sendAssignmentEmail({
        to: assignee.email,
        taskId: task.id,
        taskTitle: task.title,
      }).catch(() => undefined);
    }
  }

  return task;
}

function toTaskDetails(task: TaskWithRelations): TaskDetails {
  return {
    id: task.id,
    projectId: task.projectId,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    assigneeId: task.assigneeId,
    createdById: task.createdById,
    dueDate: task.dueDate,
    estimatedHours: task.estimatedHours,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    comments: task.comments,
    labels: task.taskLabels.map(({ label }) => label),
  };
}

// ---------------------------------------------------------------------------
// Advanced task search — GET /workspaces/:workspaceId/tasks/search
//
// Implements Phase 1 (FR-1..4, NFR-S, NFR-P) on Phase 2 ADR-001: integrated
// Postgres FTS over the `search_vector` generated column with
// websearch_to_tsquery, CASE-mapped priority sort, and OFFSET-free keyset
// (cursor) pagination. Workspace scope is structural: tasks have no
// workspace_id, so every query joins projects and predicates on
// p.workspace_id in the same WHERE that paginates (NFR-S.1).
// ---------------------------------------------------------------------------

export interface TaskSearchInput {
  /** NFR-S.1 — mandatory tenant scope (tasks.project_id → projects.workspace_id). */
  workspaceId: string;
  /** FR-1 — full-text query over title (weight A) + description (weight B). */
  q?: string;
  /** FR-2.1 — IN list; undefined = no filter. */
  statuses?: string[];
  /** FR-2.2 — IN list; undefined = no filter. */
  priorities?: string[];
  /**
   * FR-2.3 — route-resolved: uuid (`me` already substituted),
   * null = `unassigned` (assignee_id IS NULL), undefined = no filter.
   */
  assigneeId?: string | null;
  /** FR-2.6 — UUIDs pre-validated against :workspaceId; undefined = no filter. */
  projectIds?: string[];
  /**
   * FR-3.1/FR-3.2/FR-4.3 — client-requested sort. When ABSENT, the sort is
   * taken from the cursor (cursor authority), else resolved to relevance desc
   * with an effective q, else createdAt desc.
   */
  sortBy?: TaskSearchSortBy;
  /** Same resolution order as sortBy; defaults to the cursor then "desc". */
  sortOrder?: TaskSearchSortOrder;
  /** FR-4.1 — 1–100; limit + 1 rows are fetched to derive hasMore (NFR-P.3). */
  limit: number;
  /** FR-4.2 — decoded + Zod-validated keyset cursor; undefined = first page. */
  cursor?: SearchCursorPayload;
}

/** FR-3.2 — shared so the route fast-path and the service agree verbatim. */
export const RELEVANCE_REQUIRES_Q_ERROR =
  "sortBy=relevance requires a search query (q)";

/** FR-4.3 — the cursor is authoritative for the sort across a page walk. */
export const CURSOR_SORT_MISMATCH_ERROR =
  "cursor sort does not match sortBy/sortOrder";

export interface TaskSearchProjectRef {
  id: string;
  title: string;
}

export interface TaskSearchAssigneeRef {
  id: string;
  displayName: string;
}

/** E16 + FR-1.5 — task scalars, embedded relation data, search snippet. */
export interface TaskSearchResult extends Task {
  project: TaskSearchProjectRef;
  assignee: TaskSearchAssigneeRef | null;
  /** ts_headline excerpt with <mark>-wrapped matches; null when q absent. */
  snippet: string | null;
}

export interface TaskSearchPagination {
  /** Opaque token for the next page; null on the last page (FR-4.5). */
  nextCursor: string | null;
  hasMore: boolean;
}

/** Paginated response envelope — canonical { data, pagination } shape. */
export interface TaskSearchPage {
  data: TaskSearchResult[];
  pagination: TaskSearchPagination;
}

/** 400-class input problem detected at the service boundary. */
export class TaskSearchInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskSearchInputError";
  }
}

/**
 * R1 / FR-2.6 — a foreign projectId is a client bug, not a silent empty
 * page: it 400s before the main query runs.
 */
export class ProjectNotInWorkspaceError extends TaskSearchInputError {
  constructor() {
    super("projectId filter contains a project outside this workspace");
    this.name = "ProjectNotInWorkspaceError";
  }
}

// timestamptz sentinels — make NULL dueDate behave as "sorts last" for BOTH
// directions (FR-3.5, E7), so the keyset comparison below never meets a NULL
// (a row-value compare against NULL silently drops rows).
const NEG_INFINITY_TS = Prisma.sql`'-infinity'::timestamptz`;
const POS_INFINITY_TS = Prisma.sql`'infinity'::timestamptz`;

// Phase 2 §5.2 — the sort expression defined ONCE as a server-side allowlist
// of Prisma.sql fragments and spliced into SELECT, WHERE (keyset) and
// ORDER BY. sortBy comes from Zod into this table lookup only; no client
// string ever reaches SQL text, and every ${...} inside is a bound parameter.
const SORT_EXPR: Record<
  TaskSearchSortBy,
  (q: string | null, dir: TaskSearchSortOrder) => Prisma.Sql
> = {
  // relevance is only reachable when q is set (FR-3.2 validated at the
  // route, re-checked in searchTasks below).
  relevance: (q) =>
    Prisma.sql`ts_rank(t.search_vector, websearch_to_tsquery('english', ${q ?? ""}))`,
  createdAt: () => Prisma.sql`t.created_at`,
  updatedAt: () => Prisma.sql`t.updated_at`,
  // dueDate is the only nullable sort key — COALESCE to the extreme of the
  // order so the cursor predicate can use plain < / > comparisons.
  dueDate: (_q, dir) =>
    dir === "desc"
      ? Prisma.sql`COALESCE(t.due_date, ${NEG_INFINITY_TS})`
      : Prisma.sql`COALESCE(t.due_date, ${POS_INFINITY_TS})`,
  // E11 + E12: urgency rank, never lexicographic; ELSE 0 keeps unknown
  // stored values (webhook writes) deterministic instead of 500-ing.
  // R3 remediation — sorts on the STORED generated column `priority_rank`
  // (migration 20261108000001) whose CASE is byte-for-byte this mapping, so
  // priority pages ride (workspace_id, priority_rank, id) instead of
  // evaluating the CASE per row. The integration suite's CASE oracle proves
  // the two definitions stay equal.
  priority: () => Prisma.sql`t.priority_rank`,
  title: () => Prisma.sql`t.title`,
};

/**
 * Re-cast the cursor's raw `v` to the type of its sort expression (Phase 2
 * §5.3 point 2): the cursor stores the RAW value (null for a NULL dueDate)
 * and SQL re-coalesces it to the same sentinel the ORDER BY uses.
 *
 * B3 fix — timestamp cursors carry the full-precision UTC text Postgres
 * produced (`to_char(... AT TIME ZONE 'UTC', '...US')`), bound straight as
 * `$n::timestamptz`. Routing it through JS `Date` would truncate to
 * milliseconds and silently re-serve/skip rows in sub-millisecond tie
 * groups (µs written by now() within one transaction). The codec enforces
 * a strict ISO shape, so the parameter always parses.
 */
function cursorValueSql(cursor: SearchCursorPayload): Prisma.Sql {
  switch (cursor.sortBy) {
    case "relevance":
      return Prisma.sql`${cursor.v}::real`;
    case "priority":
      return Prisma.sql`${cursor.v}::int`;
    case "title":
      return Prisma.sql`${cursor.v}::text`;
    case "createdAt":
    case "updatedAt":
      return Prisma.sql`${cursor.v}::timestamptz`;
    case "dueDate": {
      // NULL dueDate (v: null) behaves as the extreme of the order under
      // NULLS LAST — splice the sentinel literal directly (constant SQL,
      // never client text) instead of binding a null parameter.
      if (cursor.v === null) {
        return cursor.sortOrder === "desc" ? NEG_INFINITY_TS : POS_INFINITY_TS;
      }

      return cursor.sortOrder === "desc"
        ? Prisma.sql`COALESCE(${cursor.v}::timestamptz, ${NEG_INFINITY_TS})`
        : Prisma.sql`COALESCE(${cursor.v}::timestamptz, ${POS_INFINITY_TS})`;
    }
  }
}

/**
 * FR-4.4 — keyset predicate mirroring the ORDER BY exactly.
 *
 * ORDER BY is `<sortExpr> <dir> NULLS LAST, t.id ASC` — the id tiebreaker is
 * id ASC in BOTH directions (strict constraint) — so the "rows after the
 * cursor" predicate is:
 *   desc:  key <  cursorKey  OR (key = cursorKey AND id > cursorId)
 *   asc:   key >  cursorKey  OR (key = cursorKey AND id > cursorId)
 * The id comparison does NOT flip with the sort direction: within a tie
 * group the page continues UPWARD in id no matter how the key sorts.
 */
function buildKeysetCondition(
  cursor: SearchCursorPayload,
  sortExpr: Prisma.Sql,
): Prisma.Sql {
  const desc = cursor.sortOrder === "desc";
  const cursorV = cursorValueSql(cursor);
  const keyOp = desc ? Prisma.sql`<` : Prisma.sql`>`;
  const idOp = Prisma.sql`>`;

  return Prisma.sql`AND (
      ${sortExpr} ${keyOp} ${cursorV}
      OR (${sortExpr} = ${cursorV} AND t.id ${idOp} ${cursor.id}::uuid)
    )`;
}

/** Raw shape of the hydrated $queryRaw rows (aliases below must stay in sync). */
interface TaskSearchRow {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string | null;
  createdById: string;
  dueDate: Date | null;
  estimatedHours: number | null;
  createdAt: Date;
  updatedAt: Date;
  projectTitle: string;
  assigneeName: string | null;
  sortV: number | string | Date | null;
  cursorTs: string | null;
  snippet: string | null;
}

// B2 fix — the hydrated "sortV" projection must NEVER contain the ±infinity
// sentinel: Prisma cannot deserialize Postgres infinity timestamps (verified
// against the live DB), so the sentinel may exist only inside ORDER BY /
// comparison expressions, never in a returned column. dueDate is the only
// key whose raw cursor value differs from the sort expression.
const CURSOR_PROJ_EXPR: Record<
  TaskSearchSortBy,
  (q: string | null) => Prisma.Sql
> = {
  relevance: (q) => SORT_EXPR.relevance(q, "desc"),
  createdAt: () => SORT_EXPR.createdAt(null, "desc"),
  updatedAt: () => SORT_EXPR.updatedAt(null, "desc"),
  dueDate: () => Prisma.sql`t.due_date`,
  priority: () => SORT_EXPR.priority(null, "desc"),
  title: () => SORT_EXPR.title(null, "desc"),
};

// B3 fix — date-key cursors take the RAW column rendered as full-precision
// UTC text in SQL (to_char … AT TIME ZONE 'UTC' keeps microseconds that JS
// Date would truncate). NULL::text for non-date keys.
function cursorTsProjection(sortBy: TaskSearchSortBy): Prisma.Sql {
  switch (sortBy) {
    case "createdAt":
    case "updatedAt":
    case "dueDate": {
      const col =
        sortBy === "createdAt"
          ? Prisma.sql`t.created_at`
          : sortBy === "updatedAt"
            ? Prisma.sql`t.updated_at`
            : Prisma.sql`t.due_date`;

      return Prisma.sql`to_char(${col} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
    }
    default:
      return Prisma.sql`NULL::text`;
  }
}

// FR-1.5 (R5): ts_headline emits user-authored text UNESCAPED, so we ask for
// escape-safe unicode sentinels instead of <b>, HTML-escape the whole
// snippet server-side, then swap the sentinels for <mark> tags (Phase 2 §5.4).
const SNIPPET_START_DELIM = "⟦";
const SNIPPET_END_DELIM = "⟧";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderSnippet(raw: string | null): string | null {
  if (raw === null) {
    return null;
  }

  return escapeHtml(raw)
    .replaceAll(SNIPPET_START_DELIM, "<mark>")
    .replaceAll(SNIPPET_END_DELIM, "</mark>");
}

function toTaskSearchResult(row: TaskSearchRow): TaskSearchResult {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assigneeId: row.assigneeId,
    createdById: row.createdById,
    dueDate: row.dueDate,
    estimatedHours: row.estimatedHours,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    project: { id: row.projectId, title: row.projectTitle },
    assignee:
      row.assigneeId !== null && row.assigneeName !== null
        ? { id: row.assigneeId, displayName: row.assigneeName }
        : null,
    snippet: renderSnippet(row.snippet),
  };
}

/** Raw cursor value for the last row of a page (NULL dueDate → null). */
function cursorValueFromRow(
  row: TaskSearchRow,
  sortBy: TaskSearchSortBy,
): number | string | null {
  switch (sortBy) {
    case "relevance":
    case "priority":
      return typeof row.sortV === "number" ? row.sortV : Number(row.sortV);
    case "title":
      return String(row.sortV);
    case "createdAt":
    case "updatedAt": {
      if (row.cursorTs !== null) {
        // B3 — µs-precise UTC text from to_char().
        return row.cursorTs;
      }

      const fallback = sortBy === "createdAt" ? row.createdAt : row.updatedAt;
      return fallback.toISOString();
    }
    case "dueDate":
      return row.cursorTs ?? null;
  }
}

// R4 remediation (Phase 2 §5.5 backstop) — pathological scans must not
// starve the OLTP instance. Applied per search transaction via
// set_config(..., is_local = true) because plain SET rejects bind params.
const SEARCH_STATEMENT_TIMEOUT_MS = 2000;

export async function searchTasks(
  input: TaskSearchInput,
): Promise<TaskSearchPage> {
  const { workspaceId, limit } = input;

  // FR-1.3 — whitespace-only q ⇒ no search at all.
  const rawQ: string | null = input.q?.trim() || null;

  // One transaction for the whole search: the statement_timeout, the
  // stopword preflight, the projectId ownership check, and the page query
  // share a consistent snapshot and a single pool checkout (NFR-P.5).
  const { rows, sortBy, sortOrder } = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`SELECT set_config('statement_timeout', ${String(
        SEARCH_STATEMENT_TIMEOUT_MS,
      )}, true)`,
    );

    // FR-1.3/E4 — stopword- or operator-only input (e.g. "the of and", "---")
    // survives the trim but lexes to an EMPTY tsquery, and `vector @@ ''`
    // matches nothing. The rule is "treated as absent, never as match
    // nothing", so detect the empty tsquery server-side (numnode = 0) and
    // drop the search condition entirely. An OR-guard inside the main WHERE
    // was rejected: it would forfeit the GIN index for every query (NFR-P.2).
    let q: string | null = rawQ;

    if (q !== null) {
      const nodesRows = await tx.$queryRaw<{ nodes: number }[]>(
        Prisma.sql`SELECT numnode(websearch_to_tsquery('english', ${q}))::int AS nodes`,
      );

      if (!nodesRows[0] || nodesRows[0].nodes === 0) {
        q = null;
      }
    }

    // FR-3.1/FR-3.2/FR-4.3 — effective sort, resolved AFTER the q reduction
    // above. Resolution order: explicit query params > decoded cursor (cursor
    // authority — a page walk may replay the cursor verbatim without repeating
    // sortBy/sortOrder) > endpoint defaults (relevance desc with an effective
    // q, createdAt desc without).
    const sortBy: TaskSearchSortBy =
      input.sortBy ??
      input.cursor?.sortBy ??
      (q !== null ? "relevance" : "createdAt");
    const sortOrder: TaskSearchSortOrder =
      input.sortOrder ?? input.cursor?.sortOrder ?? "desc";

    // FR-3.2 — rank-relevance without an effective query is a 400 (E14).
    if (sortBy === "relevance" && q === null) {
      throw new TaskSearchInputError(RELEVANCE_REQUIRES_Q_ERROR);
    }

    // FR-4.3 — when the client re-states sortBy/sortOrder they must agree
    // with the cursor; checked before any task table is touched.
    if (
      input.cursor &&
      (input.cursor.sortBy !== sortBy || input.cursor.sortOrder !== sortOrder)
    ) {
      throw new TaskSearchInputError(CURSOR_SORT_MISMATCH_ERROR);
    }

    // FR-2.6 (R1): foreign/invalid projectIds must 400 BEFORE the main query
    // — validated against :workspaceId, not by silently matching nothing.
    const projectIds =
      input.projectIds && input.projectIds.length > 0
        ? [...new Set(input.projectIds)]
        : null;

    if (projectIds) {
      const owned = await tx.$queryRaw<{ id: string }[]>(
        Prisma.sql`SELECT id FROM "projects"
          WHERE workspace_id = ${workspaceId}::uuid
            AND id = ANY(${projectIds}::uuid[])`,
      );

      if (owned.length !== projectIds.length) {
        throw new ProjectNotInWorkspaceError();
      }
    }

    const sortExpr = SORT_EXPR[sortBy](q, sortOrder);
    const dirSql = sortOrder === "desc" ? Prisma.sql`DESC` : Prisma.sql`ASC`;

    // FR-2 — filters combine with AND; OR within each IN list. Unknown stored
    // values simply never match (E12). All values are bound parameters.
    const conds: Prisma.Sql[] = [];

    if (projectIds) {
      conds.push(Prisma.sql`t.project_id = ANY(${projectIds}::uuid[])`);
    }
    if (input.statuses && input.statuses.length > 0) {
      conds.push(Prisma.sql`t.status = ANY(${input.statuses}::text[])`);
    }
    if (input.priorities && input.priorities.length > 0) {
      conds.push(Prisma.sql`t.priority = ANY(${input.priorities}::text[])`);
    }
    if (input.assigneeId === null) {
      conds.push(Prisma.sql`t.assignee_id IS NULL`); // E13 — `unassigned`
    } else if (input.assigneeId !== undefined) {
      conds.push(Prisma.sql`t.assignee_id = ${input.assigneeId}::uuid`);
    }
    if (q !== null) {
      conds.push(
        Prisma.sql`t.search_vector @@ websearch_to_tsquery('english', ${q})`,
      );
    }

    const filterSql =
      conds.length > 0
        ? Prisma.sql`AND ${Prisma.join(conds, " AND ")}`
        : Prisma.empty;
    const keysetSql = input.cursor
      ? buildKeysetCondition(input.cursor, sortExpr)
      : Prisma.empty;

    // FR-1.5 — snippet only exists when there is a query to highlight.
    // Audit #6: user-authored ⟦⟧ are scrubbed from the headline input so
    // only OUR sentinels can become <mark> tags downstream.
    const snippetSql =
      q !== null
        ? Prisma.sql`ts_headline(
            'english',
            REPLACE(REPLACE(
              COALESCE(t.title, '') || ' ' || COALESCE(t.description, ''),
              '⟦', ''), '⟧', ''),
            websearch_to_tsquery('english', ${q}),
            'StartSel=⟦,StopSel=⟧,MaxFragments=2'
          )`
        : Prisma.sql`NULL`;

    // Phase 2 §5.4 — `page` CTE: the expensive work (GIN match, ts_rank,
    // sort) runs on (id, v) only; the full DTO assembly — relation embeds
    // (NFR-P.4) and ts_headline — runs on the surviving ≤ limit + 1 rows.
    // No OFFSET, no COUNT (NFR-P.3). Same sort fragment in SELECT/WHERE/
    // ORDER BY so the cursor can never desync from the sort.
    //
    // R3 remediation — the CTE scopes on the denormalized
    // tasks.workspace_id (trigger-maintained, migration 20261108000001):
    // (workspace_id, <sortKey> DESC, id ASC) is now a true index range
    // scan per page, and the GIN match is tenant-local
    // (workspace_id, search_vector) — no global cross-tenant posting list.
    // The projects join stays in the hydration step only (for projectTitle).
    const pageRows = await tx.$queryRaw<TaskSearchRow[]>(
      Prisma.sql`
        WITH page AS (
          SELECT
            t.id,
            ${sortExpr} AS v
          FROM "tasks" t
          WHERE t.workspace_id = ${workspaceId}::uuid
          ${filterSql}
          ${keysetSql}
          ORDER BY ${sortExpr} ${dirSql} NULLS LAST, t.id ASC
          LIMIT ${limit + 1}
        )
        SELECT
          t.id,
          t.project_id AS "projectId",
          t.title,
          t.description,
          t.status,
          t.priority,
          t.assignee_id AS "assigneeId",
          t.created_by_id AS "createdById",
          t.due_date AS "dueDate",
          t.estimated_hours AS "estimatedHours",
          t.created_at AS "createdAt",
          t.updated_at AS "updatedAt",
          p.title AS "projectTitle",
          u.display_name AS "assigneeName",
          ${CURSOR_PROJ_EXPR[sortBy](q)} AS "sortV",
          ${cursorTsProjection(sortBy)} AS "cursorTs",
          ${snippetSql} AS "snippet"
        FROM page pg
        JOIN "tasks" t ON t.id = pg.id
        JOIN "projects" p ON p.id = t.project_id
        -- A1 fix — the assignee NAME embed is gated on workspace membership:
        -- assigneeId is not validated on writes outside the app layer, so a
        -- task could reference a user outside this workspace. The raw
        -- assigneeId stays on the row (DB truth); the display name is only
        -- embedded when that user is a member of :workspaceId (E13 spirit).
        LEFT JOIN "users" u
          ON u.id = t.assignee_id
          AND EXISTS (
            SELECT 1 FROM "workspace_members" wm
            WHERE wm.user_id = u.id AND wm.workspace_id = ${workspaceId}::uuid
          )
        ORDER BY pg.v ${dirSql} NULLS LAST, pg.id ASC
      `,
    );

    return { rows: pageRows, sortBy, sortOrder };
  });

  const hasMore = rows.length > limit; // FR-4.1 — over-fetch limit + 1
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const lastRow = pageRows[pageRows.length - 1];

  // FR-4.5 — nextCursor only when hasMore; replaying it on the last page
  // yields 200 with an empty data array. The token is HMAC-signed and bound
  // to this workspace (audit #6): forged/moved cursors decode to null → 400.
  const nextCursor =
    hasMore && lastRow
      ? encodeSearchCursor({
          sortBy,
          sortOrder,
          v: cursorValueFromRow(lastRow, sortBy),
          id: lastRow.id,
          ws: workspaceId,
        })
      : null;

  return {
    data: pageRows.map(toTaskSearchResult),
    pagination: { nextCursor, hasMore },
  };
}
