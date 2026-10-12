import { Router } from "express";
import { z } from "zod";
import {
  createTask,
  createComment,
  getCommentsByTaskId,
  getTask,
  listTasks,
  updateTask,
} from "../services/taskService.js";

export const taskRouter = Router();

const positiveHoursSchema = z.number().int().positive();

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

taskRouter.get("/", async (req, res) => {
  const parsedQuery = taskListQuerySchema.safeParse(req.query);

  if (!parsedQuery.success) {
    res.status(400).json({ error: getValidationErrorMessage(parsedQuery.error) });
    return;
  }

  try {
    const tasks = await listTasks(parsedQuery.data);
    res.json(tasks);
  } catch {
    res.status(500).json({ error: "failed to get tasks" });
  }
});

taskRouter.post("/", async (req, res) => {
  const parsedBody = taskCreateSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({ error: getValidationErrorMessage(parsedBody.error) });
    return;
  }

  try {
    const task = await createTask(parsedBody.data);
    res.status(201).json(task);
  } catch {
    res.status(500).json({ error: "failed to create task" });
  }
});

taskRouter.patch("/:id", async (req, res) => {
  const parsedBody = taskUpdateSchema.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({ error: getValidationErrorMessage(parsedBody.error) });
    return;
  }

  try {
    const task = await updateTask(req.params.id, parsedBody.data);
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
  try {
    const task = await getTask(req.params.id);
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

  try {
    const comment = await createComment({
      taskId: req.params.taskId,
      authorId: body.authorId,
      content: body.content,
    });

    res.status(201).json(comment);
  } catch {
    res.status(500).json({ error: "failed to create comment" });
  }
});

taskRouter.get("/:taskId/comments", async (req, res) => {
  try {
    const comments = await getCommentsByTaskId(req.params.taskId);
    res.json(comments);
  } catch {
    res.status(500).json({ error: "failed to get comments" });
  }
});
