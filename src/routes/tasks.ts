import { Router } from "express";
import { z } from "zod";
import type { Request, Response } from "express";
import {
  createTask,
  createComment,
  getCommentsByTaskId,
  getTask,
  listTasks,
  RELEVANCE_REQUIRES_Q_ERROR,
  searchTasks,
  TaskSearchInputError,
  updateTask,
} from "../services/taskService.js";
import { authenticate } from "../middleware/authenticate.js";
import {
  lookupWorkspaceMembership,
  requireWorkspaceMember,
} from "../middleware/requireWorkspaceMember.js";
import { createUserRateLimiter } from "../middleware/rateLimit.js";
import {
  decodeSearchCursor,
  TASK_SEARCH_SORT_BY,
  TASK_SEARCH_SORT_ORDER,
  type SearchCursorPayload,
} from "../utils/taskSearchCursor.js";

export const taskRouter = Router();

// ---------------------------------------------------------------------------
// R2 remediation (security audit finding #1): the legacy /tasks endpoints
// used to be unauthenticated and cross-tenant — GET /tasks?q= was a
// full-text search over EVERY workspace with no token required. The entire
// router now sits behind JWT authentication plus a workspace-membership
// check driven by a mandatory workspaceId query param. These routes remain
// DEPRECATED (Phase 1 NFR-M.2): the sanctioned successor is
// GET /workspaces/:workspaceId/tasks/search.
// ---------------------------------------------------------------------------
taskRouter.use(authenticate);

taskRouter.use((_req, res, next) => {
  res.setHeader("Deprecation", "true");
  next();
});

const positiveHoursSchema = z.coerce.number().int().positive();

const taskCreateSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  status: z.enum(["todo", "in_progress", "done", "cancelled"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  createdById: z.string().uuid(),
  dueDate: z.coerce.date().nullable().optional(),
  estimatedHours: positiveHoursSchema.optional(),
});

const taskUpdateSchema = taskCreateSchema
  .partial()
  .omit({ projectId: true, createdById: true });

const taskListQuerySchema = z.object({
  q: z.string().max(256).optional(),
  estimatedHours: z.coerce.number().int().positive().optional(),
  sortBy: z.enum(["createdAt", "estimatedHours"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

interface CreateCommentBody {
  authorId?: string;
  content?: string;
}

function getValidationErrorMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "invalid input";
}

const legacyScopeSchema = z.object({ workspaceId: z.string().uuid() });

/**
 * Legacy-router tenant gate: validate `?workspaceId=<uuid>`, confirm the
 * authenticated user is a member, and answer the request (400/401/404/500)
 * or return the verified workspace id. Non-members and unknown workspaces
 * get the identical 404 body (E2) — before any task query runs (NFR-S.3).
 */
async function verifiedWorkspaceId(
  req: Request,
  res: Response,
): Promise<string | null> {
  const parsed = legacyScopeSchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({
      error:
        "workspaceId query param (uuid) is required — /tasks is deprecated; use /workspaces/:workspaceId/tasks/search",
    });
    return null;
  }

  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: "authentication required" });
    return null;
  }

  try {
    const membership = await lookupWorkspaceMembership(
      userId,
      parsed.data.workspaceId,
    );

    if (!membership) {
      res.status(404).json({ error: "workspace not found" });
      return null;
    }

    return parsed.data.workspaceId;
  } catch {
    res.status(500).json({ error: "failed to verify workspace membership" });
    return null;
  }
}

taskRouter.get("/", async (req, res) => {
  const parsedQuery = taskListQuerySchema.safeParse(req.query);

  if (!parsedQuery.success) {
    res
      .status(400)
      .json({ error: getValidationErrorMessage(parsedQuery.error) });
    return;
  }

  const workspaceId = await verifiedWorkspaceId(req, res);

  if (!workspaceId) {
    return;
  }

  try {
    const tasks = await listTasks({ ...parsedQuery.data, workspaceId });
    res.json(tasks);
  } catch {
    res.status(500).json({ error: "failed to get tasks" });
  }
});

taskRouter.post("/", async (req, res) => {
  const parsedBody = taskCreateSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({ error: JSON.stringify(parsedBody.error.issues) });
    return;
  }

  const workspaceId = await verifiedWorkspaceId(req, res);

  if (!workspaceId) {
    return;
  }

  try {
    const task = await createTask({
      ...parsedBody.data,
      workspaceId,
    });
    res.status(201).json(task);
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message === "Project not found in workspace"
    ) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: "failed to create task" });
  }
});

taskRouter.patch("/:id", async (req, res) => {
  const parsedBody = taskUpdateSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({ error: JSON.stringify(parsedBody.error.issues) });
    return;
  }

  const workspaceId = await verifiedWorkspaceId(req, res);

  if (!workspaceId) {
    return;
  }

  try {
    const task = await updateTask(req.params.id, parsedBody.data, workspaceId);
    res.json(task);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Task not found") {
      res.status(404).json({ error: "not found" });
      return;
    }

    res.status(500).json({ error: "failed to update task" });
  }
});

taskRouter.get("/:id", async (req, res) => {
  const workspaceId = await verifiedWorkspaceId(req, res);

  if (!workspaceId) {
    return;
  }

  try {
    const task = await getTask(req.params.id, workspaceId);
    res.json(task);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Task not found") {
      res.status(404).json({ error: "not found" });
      return;
    }

    res.status(500).json({ error: "server error" });
  }
});

taskRouter.post("/:taskId/comments", async (req, res) => {
  const body = req.body as CreateCommentBody;

  if (!body.authorId || !body.content) {
    res.status(400).json({ error: "authorId and content required" });
    return;
  }

  const workspaceId = await verifiedWorkspaceId(req, res);

  if (!workspaceId) {
    return;
  }

  try {
    const comment = await createComment({
      workspaceId,
      taskId: req.params.taskId,
      authorId: body.authorId,
      content: body.content,
    });

    res.status(201).json(comment);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Task not found") {
      res.status(404).json({ error: "not found" });
      return;
    }

    res.status(500).json({ error: "failed to create comment" });
  }
});

taskRouter.get("/:taskId/comments", async (req, res) => {
  const workspaceId = await verifiedWorkspaceId(req, res);

  if (!workspaceId) {
    return;
  }

  try {
    const comments = await getCommentsByTaskId(req.params.taskId, workspaceId);
    res.json(comments);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Task not found") {
      res.status(404).json({ error: "not found" });
      return;
    }

    res.status(500).json({ error: "failed to get comments" });
  }
});

// ---------------------------------------------------------------------------
// GET /workspaces/:workspaceId/tasks/search — Advanced Task Search
// (Phase 1 requirements + Phase 2 ADR-001; canonical { data, pagination }
// envelope, keyset pagination, no OFFSET.)
// ---------------------------------------------------------------------------

// Workspace-addressed sub-router for the advanced task search endpoint
// (Phase 1 E1: scope is structural — the workspace id lives in the path).
// Mounted with mergeParams in app.ts at /workspaces/:workspaceId/tasks.
export const workspaceTaskSearchRouter = Router({ mergeParams: true });

// NFR-S.6 — 60 searches per minute per authenticated user (429 + Retry-After).
// Exported so tests can reset the window between specs.
export const searchRateLimiter = createUserRateLimiter({
  limit: 60,
  windowMs: 60_000,
});

const taskStatusSchema = z.enum(["todo", "in_progress", "done", "cancelled"]);
const taskPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);

/**
 * FR-2 — multi-value filters accept repeated params (`status=todo&status=done`)
 * or CSV (`status=todo,done`). Both normalize to a trimmed array; invalid
 * members are rejected by the item schema before any DB access (FR-2.4).
 */
function csvList<T extends z.ZodTypeAny>(item: T) {
  return z.preprocess(
    (val) => {
      if (val === undefined) {
        return undefined;
      }

      const raw = Array.isArray(val) ? val : [val];
      return raw
        .flatMap((entry) =>
          typeof entry === "string" ? entry.split(",") : [entry],
        )
        .map((entry) => (typeof entry === "string" ? entry.trim() : entry))
        .filter((entry) => entry !== "");
    },
    // R4 remediation — bounded IN lists (a 10k-term status list is a 400).
    z.array(item).max(20).optional(),
  );
}

const taskSearchQuerySchema = z.object({
  // R4 remediation (security audit #5): cap attacker-controlled string sizes
  // BEFORE they reach tsquery parsing / ts_headline CPU.
  q: z.string().max(256).optional(),
  status: csvList(taskStatusSchema),
  priority: csvList(taskPrioritySchema),
  assigneeId: z
    .union([z.string().uuid(), z.literal("me"), z.literal("unassigned")])
    .optional(),
  projectId: csvList(z.string().uuid()),
  sortBy: z.enum(TASK_SEARCH_SORT_BY).optional(),
  // Omitted ⇒ the service resolves the effective direction (cursor
  // authority first, then "desc") so a verbatim cursor replay without any
  // sort params continues the exact page walk (FR-4.2/FR-4.3).
  sortOrder: z.enum(TASK_SEARCH_SORT_ORDER).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().max(1024).optional(),
});

// A type alias (not an interface) so it carries an implicit index signature
// and stays assignable to express's ParamsDictionary for the shared
// middlewares mounted ahead of this handler.
type WorkspaceTaskSearchParams = {
  /** Route-scoped workspace id (merged from the /workspaces/:workspaceId mount). */
  workspaceId: string;
};

workspaceTaskSearchRouter.get<WorkspaceTaskSearchParams>(
  "/search",
  authenticate,
  requireWorkspaceMember,
  searchRateLimiter.middleware,
  async (req, res) => {
    const parsedQuery = taskSearchQuerySchema.safeParse(req.query);

    if (!parsedQuery.success) {
      res
        .status(400)
        .json({ error: getValidationErrorMessage(parsedQuery.error) });
      return;
    }

    const {
      q: rawQ,
      sortBy: requestedSortBy,
      sortOrder,
      limit,
      cursor: cursorToken,
    } = parsedQuery.data;

    // FR-1.3 — whitespace/punctuation-only q behaves as absent, never as
    // "match nothing" (E4). Stopword/junk-only queries are reduced
    // server-side in searchTasks; the effective sort is resolved there too
    // (FR-3.1/FR-3.2) so cursor and query can never disagree on defaults.
    const q = rawQ?.trim() || undefined;

    // FR-3.2 fast path — explicit relevance without any search term is a 400
    // before a DB round trip.
    if (requestedSortBy === "relevance" && !q) {
      res.status(400).json({ error: RELEVANCE_REQUIRES_Q_ERROR });
      return;
    }

    // FR-4.2 — verify + decode the signed, workspace-bound cursor; strict
    // validation (E9) happens inside the codec. Malformed/tampered/
    // cross-workspace ⇒ 400, never 500, never interpolated.
    let cursor: SearchCursorPayload | undefined;

    if (cursorToken !== undefined) {
      cursor =
        decodeSearchCursor(cursorToken, req.params.workspaceId) ?? undefined;

      if (!cursor) {
        res.status(400).json({ error: "invalid cursor" });
        return;
      }
    }

    // FR-4.3 — cursor-vs-sort consistency is checked in the service, which
    // owns the effective sort.

    // requireWorkspaceMember already verified membership and normalized the
    // id (404 for missing workspace / non-member, 401 without auth) — this
    // runs strictly BEFORE any tasks query (NFR-S.1, NFR-S.3).
    const workspaceId = req.params.workspaceId;

    // FR-2.3 (E13) — resolve the `me` sentinel to the authenticated user.
    let assigneeId: string | null | undefined;

    if (parsedQuery.data.assigneeId === "me") {
      if (!req.user?.id) {
        res.status(401).json({ error: "authentication required" });
        return;
      }

      assigneeId = req.user.id;
    } else if (parsedQuery.data.assigneeId === "unassigned") {
      assigneeId = null;
    } else {
      assigneeId = parsedQuery.data.assigneeId;
    }

    try {
      const page = await searchTasks({
        workspaceId,
        q,
        statuses: parsedQuery.data.status,
        priorities: parsedQuery.data.priority,
        assigneeId,
        projectIds: parsedQuery.data.projectId,
        sortBy: requestedSortBy,
        sortOrder,
        limit,
        cursor,
      });

      res.json(page);
    } catch (error: unknown) {
      if (error instanceof TaskSearchInputError) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: "failed to search tasks" });
    }
  },
);
