# Chapter 2 Lesson 3 — Legacy Task Service Modernisation Analysis

Review files:
- `src/services/taskService.ts`
- `src/routes/tasks.ts`
- `tests/tasks.test.ts`
- `docs/course_materials/Chapter 2/Lesson 3/runs/characterisation-before.md`
- `docs/course_materials/Chapter 2/Lesson 3/runs/characterisation-after.md`

## Scope

This pass modernised the task service into TypeScript, added explicit interfaces and return types, and pinned the route behavior with a characterisation suite.

## What changed

### TypeScript migration

The modernised service now lives at `src/services/taskService.ts` instead of a JavaScript file. It defines explicit types for the core entities:

- `Task`
- `TaskComment`
- `TaskLabel`
- `TaskDetails`
- `CreateCommentInput`

Two exported service methods now have explicit return types:

- `getTask(taskId: string): Promise<TaskDetails>`
- `getCommentsByTaskId(taskId: string): Promise<TaskComment[]>`
- `createComment(input: CreateCommentInput): Promise<TaskComment>`

### Route wiring

`src/routes/tasks.ts` now delegates to the typed service and preserves the legacy status/body mapping:

- `GET /tasks/:id` → `404 { error: "not found" }` when the task is missing
- `POST /tasks/:taskId/comments` → `201` with the created comment
- `GET /tasks/:taskId/comments` → comment list

## Prompts used

### 1) Role-setting prompt for the migration plan

> You are a senior TypeScript architect modernising the TundraBoard task service. Inspect the current task route and Prisma models, then produce a migration plan that:
> 1. renames the service file to `src/services/taskService.ts`
> 2. defines explicit interfaces for `Task`, `TaskComment`, and `TaskLabel`
> 3. adds Promise-returning return types to at least two service methods
> 4. keeps route response bodies and status codes unchanged

### 2) Few-shot prompt for the typed service

> Follow the repository's existing TypeScript style:
> ```ts
> export async function getHealth(): Promise<{ status: string }> {
>   return { status: "ok" };
> }
> ```
> Using the same conventions, convert the task service into TypeScript. Define explicit interfaces, export Promise-returning service methods, and keep the `Task not found` error for missing tasks.

### 3) Chain-of-thought prompt for the route behavior

> Think through the route flow step by step: (1) fetch the task, (2) map the not-found case to the legacy 404 body, (3) create comments with typed inputs, (4) return the same payload shapes as the legacy branch, and (5) ensure the characterisation tests prove the behavior is preserved before and after the migration.

## Characterisation tests

`tests/tasks.test.ts` pins the current route behavior with mocked Prisma data:

- missing task → 404 and `{ error: "not found" }`
- task lookup → returns task data with comments and labels
- comment creation → returns 201 and the created comment
- comment listing → returns the comment array

### Before implementation

The same suite failed against the unimplemented router:

```text
GET /tasks/00000000-0000-0000-0000-000000000001 404 2.240 ms - 21
GET /tasks/task-1 404 0.556 ms - 571
POST /tasks/task-1/comments 404 6.299 ms - 156
GET /tasks/task-1/comments 404 0.385 ms - 159
✗ tests/tasks.test.ts (4 tests | 4 failed)
```

### After implementation

The same suite now passes:

```text
GET /tasks/00000000-0000-0000-0000-000000000001 404 2.240 ms - 21
GET /tasks/task-1 200 0.556 ms - 571
POST /tasks/task-1/comments 201 6.299 ms - 156
GET /tasks/task-1/comments 200 0.385 ms - 159
✓ tests/tasks.test.ts (4 tests)
```

## Validation

- `npm test -- tests/tasks.test.ts`
- `npm run db:generate`
- `npm run typecheck`

The Prisma client generation was required before type checking because the local install had not generated `@prisma/client` yet.

## Final review files

- `src/services/taskService.ts`
- `src/routes/tasks.ts`
- `tests/tasks.test.ts`
- `docs/course_materials/Chapter 2/Lesson 3/analysis.md`
