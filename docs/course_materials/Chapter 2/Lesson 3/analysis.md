# Chapter 2 Lesson 3 — Legacy Task Service Modernisation Analysis

Review files:
- `src/services/taskService.js`
- `src/routes/tasks.js`
- `docs/course_materials/Chapter 1/Lesson 4/reasoning_budget_policy.md`
- `docs/course_materials/Chapter 1/Lesson 4/mode_choice_analysis.md`
- `docs/course_materials/Chapter 2/Lesson 2/analysis.md`

## Scope and constraints

This deliverable is a documentation-only modernisation plan for the legacy task service. No source files, tests, or package files were changed.

## Delivery mode record

- **Worker and mode:** course-exercise-orchestrator using fast generation (`gpt-5.4-mini`, low effort).
- **Rationale:** this was a bounded, evidence-to-documentation task based on two fixed legacy files and explicit lesson requirements; it did not require a migration, deployment decision, or branching investigation.
- **Budget cap:** 10 tool hops and £0.50 estimated hidden-reasoning spend. The Chapter 1 policy reserves extended thinking for consequential multi-file or investigative risk.
- **Latency:** the orchestration result did not expose runtime telemetry, so no latency is asserted or estimated.
- **Escalation evidence:** use extended thinking only if inspection reveals an unresolved dependency that changes the safe conversion boundary, or if a characterization test exposes a behavior mismatch. No such evidence was found for this written submission.

## Modernisation plan

### Outdated patterns found

Grounded in the legacy service and route:

1. Callback-based async flow everywhere
   - `createTask`, `getTask`, `updateTask`, `deleteTask`, `listTasks`, `createComment`, `getCommentsByTaskId`, `addLabelToTask`, and the route handlers all use nested callbacks.
   - Risk: medium/high because callback-to-async changes can alter timing and error propagation.

2. Missing function and value types
   - All functions are untyped JavaScript.
   - Route inputs rely on `req.body`, `req.params`, and `req.query` without shape checks.
   - Risk: low/medium because types are mechanical, but they expose hidden assumptions.

3. God-class responsibility sprawl
   - One module mixes tasks, comments, labels, notifications, webhooks, audit logging, and user helpers.
   - Risk: medium/high because extraction can break shared helper assumptions.

4. Hardcoded SQL and string interpolation
   - Queries interpolate raw values directly into SQL strings.
   - Risk: high, but outside this lesson’s smallest safe written deliverable; note as later follow-up.

5. Route-layer duplication
   - Status mapping and error translation are repeated per endpoint.
   - Risk: low/medium; good candidate after service boundaries are clear.

### Risk-effort matrix

| Pattern | Risk | Effort | Priority |
| --- | --- | --- | --- |
| Add types to function signatures | Low | Low | Do first |
| Pin current behavior with characterization tests | Low | Low | Do first |
| Convert a single callback chain to async/await | Medium | Medium | Do after tests |
| Extract one responsibility into a separate module | Medium | Medium | Do after service call sites are stable |
| Replace interpolated SQL with parameterized queries | High | High | Later |

### Dependency-ordered transformation sequence

1. Write characterization tests for current behavior.
2. Add types to the smallest stable callback surface:
   - `createComment(...)`
   - `getCommentsByTaskId(...)`
3. Establish the promise boundary needed by the callback conversion:
   - use the database driver's promise API, if available, or wrap `db.query` once in a typed adapter;
   - convert the leaf reads `getCommentsByTaskId` and `getLabelsByTaskId` before their `getTask` caller.
4. Convert the callback-heavy `getTask` path and its direct `GET /:id` caller to async/await together. This is the smallest safe boundary because changing the service contract alone would leave the route passing a callback that is no longer used.
5. Extract one responsibility:
   - Move notification creation / notification policy out of `taskService.js`.
6. Re-run the characterization tests after each step.

## Characterization-test notes

Planned pinning coverage before edits:

- `GET /tasks/:id` returns 404 with `{ error: 'not found' }` when the service reports `Task not found`.
- `GET /tasks/:id` returns the task with `comments` and `labels` attached when both helper calls succeed.
- `POST /tasks/:taskId/comments` returns 201 and the created comment.
- `GET /tasks` requires `projectId` and returns 400 when missing.
- `DELETE /tasks/:id` returns 204 on success.

Test-file plan:

- Add or update a focused route/service characterization file beside the existing lesson artifacts, or in the repository test suite if the exercise later permits code changes.
- Prefer route-level assertions for status codes and payload shape, with service mocks for current callback behavior.

## Transformation 1 — callbacks to async/await

### Prompt used

> Convert the `getTask` path from the legacy task service to async/await. First make the `getCommentsByTaskId` and `getLabelsByTaskId` leaf reads return promises (using the database driver's promise API or one `db.query` adapter). Then update the direct `GET /:id` route caller to await `getTask`. Preserve the `Task not found` error, sequential comments-then-labels lookup, final object shape, and existing 404/500 response bodies.

### Before

```js
function getTask(taskId, callback) {
  db.query("SELECT * FROM tasks WHERE id = '" + taskId + "'", function(err, result) {
    if (err) {
      callback(err, null);
      return;
    }
    if (result.rows.length === 0) {
      callback(new Error('Task not found'), null);
      return;
    }
    var task = result.rows[0];

    // Get comments for this task
    getCommentsByTaskId(taskId, function(commentErr, comments) {
      if (commentErr) {
        callback(commentErr, null);
        return;
      }
      task.comments = comments;

      // Get labels for this task
      getLabelsByTaskId(taskId, function(labelErr, labels) {
        if (labelErr) {
          callback(labelErr, null);
          return;
        }
        task.labels = labels;
        callback(null, task);
      });
    });
  });
}
```

### After

```js
async function getTask(taskId) {
  const result = await db.query("SELECT * FROM tasks WHERE id = '" + taskId + "'");
  if (result.rows.length === 0) {
    throw new Error('Task not found');
  }

  const task = result.rows[0];
  const comments = await getCommentsByTaskId(taskId);
  const labels = await getLabelsByTaskId(taskId);

  return {
    ...task,
    comments,
    labels,
  };
}

router.get('/:id', async function(req, res) {
  try {
    const task = await taskService.getTask(req.params.id);
    res.json(task);
  } catch (err) {
    if (err.message === 'Task not found') {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.status(500).json({ error: 'server error' });
  }
});
```

### Verification notes

- Expected behavior to re-pin: empty result still maps to the same not-found semantics.
- Expected follow-up check: comments and labels are still attached after sequential reads in the same order of operations.
- The test double must make the database adapter and the two leaf helpers return promises; otherwise `await getCommentsByTaskId(...)` would not preserve the legacy contract.
- Test the route as well as the service: the route must await the promise so a rejected `Task not found` still yields the legacy 404 body rather than an unhandled rejection.
- Because this is a documentation-only deliverable, no repository test run was executed.

## Transformation 2 — typed functions

### Prompt used

> Add TypeScript-style types to two legacy functions while keeping the current runtime behavior unchanged. Start with `createComment(taskId, authorId, content, callback)` and `getCommentsByTaskId(taskId, callback)`. Preserve the existing callback contract and the best-effort notification behavior.

### Before

```js
function createComment(taskId, authorId, content, callback) {
  var id = crypto.randomUUID();
  var query = "INSERT INTO comments (id, task_id, author_id, content, created_at, updated_at) VALUES ('" + id + "', '" + taskId + "', '" + authorId + "', '" + content + "', NOW(), NOW()) RETURNING *";
  ...
}

function getCommentsByTaskId(taskId, callback) {
  db.query("SELECT * FROM comments WHERE task_id = '" + taskId + "' ORDER BY created_at ASC", function(err, result) {
    if (err) {
      callback(err, null);
      return;
    }
    callback(null, result.rows);
  });
}
```

### After

```ts
function createComment(
  taskId: string,
  authorId: string,
  content: string,
  callback: (err: Error | null, comment?: unknown) => void
): void {
  ...
}

function getCommentsByTaskId(
  taskId: string,
  callback: (err: Error | null, comments?: unknown[]) => void
): void {
  ...
}
```

### Verification notes

- The callback shape stays unchanged, so current route callers should not need updates yet.
- The type pass should be validated by re-running the same characterization tests that pin `POST /tasks/:taskId/comments` and `GET /tasks/:taskId/comments`.
- No code or tests were executed in this docs-only pass.

## Transformation 3 — responsibility extraction

### Prompt used

> Extract one responsibility from `taskService.js` without changing the public API of the task service. Prefer a boundary that reduces the size of the service file without forcing route rewrites. Preserve the current notification behavior and keep the extraction isolated.

### Before

```js
function createTask(taskData, callback) {
  ...
  if (assigneeId) {
    createNotification(assigneeId, 'task_assigned', 'You have been assigned a new task: ' + title, { taskId: id }, function(notifErr) {
      if (notifErr) {
        console.log('Failed to create notification:', notifErr);
      }
      callback(null, task);
    });
  } else {
    callback(null, task);
  }
}
```

### After

```js
// services/notificationService.js
var db = require('../db');
var crypto = require('crypto');

function createNotification(userId, type, body, metadata, callback) {
  var id = crypto.randomUUID();
  var metadataStr = JSON.stringify(metadata);
  db.query(/* unchanged legacy INSERT */, function(err) {
    if (err) {
      if (callback) callback(err);
      return;
    }
    if (callback) callback(null);
  });
}

module.exports = { createNotification };

// services/taskService.js
var notificationService = require('./notificationService');

function notifyTaskAssignment(assigneeId, title, taskId, callback) {
  notificationService.createNotification(
    assigneeId,
    'task_assigned',
    'You have been assigned a new task: ' + title,
    { taskId: taskId },
    callback
  );
}
```

### Verification notes

- The extraction moves the existing notification implementation (and its `crypto`/`db` dependencies) into the notification module; it does not create a helper that relies on an out-of-scope `createNotification`.
- The extracted helper should be covered by the same task-creation characterization test that checks the task still succeeds even if notification delivery fails.
- Route status codes remain unchanged because the public service API remains intact.
- No repository extraction was executed in this docs-only pass.

## Final review files

- `docs/course_materials/Chapter 2/Lesson 3/analysis.md`

## Status

Blocker: none for the documentation deliverable.

Implementation boundary: the legacy module is inspected from a remote branch and the requested deliverables are under the lesson directory. This submission therefore records proposed, source-faithful transformations rather than modifying that legacy branch or claiming runtime evidence.
