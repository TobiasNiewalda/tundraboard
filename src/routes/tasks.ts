import { Router } from "express";
import {
  createComment,
  getCommentsByTaskId,
  getTask,
} from "../services/taskService.js";

export const taskRouter = Router();

interface CreateCommentBody {
  authorId?: string;
  content?: string;
}

taskRouter.get("/:id", async (req, res) => {
  try {
    const task = await getTask(req.params.id);
    res.json(task);
  } catch (error) {
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
  } catch (error) {
    res.status(500).json({ error: "failed to create comment" });
  }
});

taskRouter.get("/:taskId/comments", async (req, res) => {
  try {
    const comments = await getCommentsByTaskId(req.params.taskId);
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: "failed to get comments" });
  }
});
