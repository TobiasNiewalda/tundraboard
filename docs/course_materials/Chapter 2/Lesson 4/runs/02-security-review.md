# Security Review Template Run

## Template used

`template-library/review/security-review.md`

## Filled prompt

You are a security-focused reviewer for TundraBoard.

Review this file:

```ts
import { Router } from "express";
import { createComment, getCommentsByTaskId, getTask } from "../services/taskService.js";

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
```

Supporting context:

- `src/app.ts`
- `src/services/taskService.ts`
- `tests/tasks.test.ts`
- `src/middleware/errorHandler.ts`

Authorisation constraints:

- Preserve the repo's current route-level contract
- Do not leak internal error details to clients
- Flag any route mounted without auth or ownership checks if it exposes task or comment data

Sensitive data rules:

- Do not expose password hashes or internal service errors
- Keep response payloads limited to task/comment data

Follow this project pattern when judging the implementation:

```ts
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
```

Report only high-confidence findings. For each finding, include:

1. severity
2. exact file and line reference
3. why it matters
4. a concrete fix

If there are no high-confidence findings, say so plainly.

## AI output

1. **High** — `src/app.ts:34-42` mounts `/tasks` without any authentication middleware, and `src/routes/tasks.ts:15-56` serves task and comment data without ownership or workspace membership checks. That leaves task data accessible to any caller who can guess an ID. Fix: require authentication at the route boundary and verify workspace membership or ownership before returning task/comment data.
2. **Medium** — `src/routes/tasks.ts:29-44` bypasses runtime validation by casting `req.body` to `CreateCommentBody`. The `authorId` and `content` checks only guard against missing values, not malformed payloads, so non-string values can still slip through until the service layer. Fix: validate with a Zod schema or explicit type guards before calling `createComment`.
3. **Medium** — `src/middleware/errorHandler.ts:7-20` returns `err.message` to clients and includes stack traces in development. That leaks internal failure details whenever routes bubble errors through the global handler. Fix: return a stable client-facing error message and keep detailed logging server-side only.
4. **Medium** — `src/routes/tasks.ts:42-47` reads `req.body` before the `try` block, so a `null` JSON body can throw before the route's own error handling runs. Fix: validate the body shape before property access or wrap the extraction in the same error boundary.
5. **No other high-confidence data-leak findings** — the file does not expose secrets beyond the error-disclosure issues noted above.

## Assessment

This template produced a good security review because it forced exact line references and filtered for high-confidence issues only. The main strength was catching the missing auth boundary, error disclosure, and the validation bypass without drifting into speculative claims. If I used this again, I would keep the prompt explicitly tied to app-level routing as well as the target file so access-control issues are harder to miss.
