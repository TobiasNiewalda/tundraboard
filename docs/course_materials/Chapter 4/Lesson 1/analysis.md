# Chapter 4 Lesson 1 — Terminal Agent Exercise Analysis

Review files:

- `src/routes/health.ts`
- `tests/health.test.ts`
- `.github/agents/terminal-agent.agent.md`
- `docs/course_materials/Chapter 4/Lesson 1/runs/terminal-agent-validation.md`

## Scope

This lesson asks for a balanced terminal-agent configuration, a bounded task specification, execution logging, validation, and evaluation. The requested health endpoint is already implemented in the repository, so this pass documents the verified result and packages the reusable agent definition for future terminal-agent work.

## Permission configuration

Balanced terminal-agent defaults for this repo:

- Auto-approve file reads and code-generation tasks.
- Require approval for file writes, shell commands, and network access.
- Restrict access to the project directory.
- Further restrict reads to project files only, and deny common non-source paths such as `.git/`, `node_modules/`, `coverage/`, `dist/`, build caches, and local logs.
- Exclude credential-bearing files by default, including `.env`, `.env.*`, `*.pem`, `*.key`, `*secret*`, `*credential*`, and other secret-store paths.
- Exclude `.env` files and credential stores by applying explicit deny rules in the agent's file scope so they are neither surfaced in prompts nor opened for reads.

How the exclusions work:

- `.env` and `.env.*` are blocked at the path filter level, so the agent cannot include them in its read set or prompt context.
- Credential stores are excluded with the same deny-list approach, using path patterns for common secret files and directories plus any repo-specific secret locations.
- When a file matches an exclusion rule, the agent should treat it as unavailable rather than redacting its contents after the fact.

## Task specification

> Add a task estimation system to TundraBoard. Introduce an optional `estimatedHours` field on `Task` as a positive number, update the task creation and update endpoints to accept it, add filtering and sorting by estimated hours to the list endpoint, and add tests.

Acceptance criteria:

- `POST /tasks` accepts `estimatedHours` as an optional positive number.
- `PATCH /tasks/:id` accepts `estimatedHours` and preserves validation rules for the rest of the update payload.
- `GET /tasks` can filter and sort by `estimatedHours` using the repository's existing query conventions.
- The API rejects invalid values such as negative numbers, zero, and non-numeric input.
- Tests cover the happy path, validation failures, and list filtering/sorting behaviour.

Suggested test shape:

- one test for creating a task with `estimatedHours`
- one test for updating a task to add or change `estimatedHours`
- one test for filtering or sorting the task list by `estimatedHours`
- one test for invalid `estimatedHours` input

## Execution log

### Plan


1. Add estimatedHours to the Prisma Task model as an optional positive whole number, then generate the migration and refresh the client.
2. Extend the task service so task records and update inputs carry estimatedHours end to end, and add the create/list service helpers needed by the missing task list flow.
3. Add request validation in the task routes with zod. Keep body validation strict for POST and PATCH so negative, zero, and non-numeric values are rejected, and validate GET query params with flat filter/sort fields.
4. Implement the missing task endpoints in the task router: POST /tasks, PATCH /tasks/:id, and GET /tasks. The list endpoint should support estimatedHours filtering and sorting, and the existing assignee-change email behavior should remain intact.
5. Expand the tests to cover the new happy paths, invalid estimatedHours input, and list filtering/sorting behavior. Update the service test coverage so the new field is preserved through the update path.
6. Validate in stages: focused task tests first, then typecheck, lint, and finally the full test suite.

Decisions

estimatedHours should be stored and validated as a positive whole number, not a fractional value.
Because the current code only exposes task detail and comment routes, the task list endpoint will be added as part of this ticket.
The list API will use flat query params rather than a nested filter object.

### Approvals

- The agent's planning mode wants to clarify the following question """Should `estimatedHours`allow fractional values, or only whole numbers? The ticket say `positive numbers`but the schema choice affects storage, validation, and tests. 1) Fractional values allowed, 2) Whole numbers only, 3) Match existing numerical conventions"""
- The agent asks "How should the new Get /tasks filtering and sorting be expressed? There is no existing task list endpoint to copy, so this choice sets the API share for the ticket." The agent proposed three options.
- I approved continuing with implementation.
- I approved executing npm test commands. A step that I would allow my agent to perform without separate approval in future.

### Changes

- CHanged files: "schema.prisma", "migration.sql", "taskService.ts", "tasks.ts", "taskService.test.ts", "task.test.ts"
- The reusable terminal-agent definition was added at `.github/agents/terminal-agent.agent.md`.

#### schema.prisma

```
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================================
// Core entities for TundraBoard task management platform
// ============================================================================

model User {
  id           String   @id @default(uuid()) @db.Uuid
  email        String   @unique @db.VarChar(255)
  displayName  String   @map("display_name") @db.VarChar(100)
  passwordHash String   @map("password_hash") @db.VarChar(255)
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt    DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  // Relations
  workspaceMembers WorkspaceMember[]
  createdTasks     Task[]           @relation("TaskCreator")
  assignedTasks    Task[]           @relation("TaskAssignee")
  comments         Comment[]
  auditLogs        AuditLog[]

  @@map("users")
}

model Workspace {
  id        String   @id @default(uuid()) @db.Uuid
  name      String   @db.VarChar(100)
  slug      String   @unique @db.VarChar(100)
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  // Relations
  members      WorkspaceMember[]
  projects     Project[]
  labels       Label[]
  webhooks     Webhook[]
  auditLogs    AuditLog[]

  @@map("workspaces")
}

model WorkspaceMember {
  id          String   @id @default(uuid()) @db.Uuid
  userId      String   @map("user_id") @db.Uuid
  workspaceId String   @map("workspace_id") @db.Uuid
  role        String   @default("member") @db.VarChar(20) // admin | member | viewer
  joinedAt    DateTime @default(now()) @map("joined_at") @db.Timestamptz

  // Relations
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@unique([userId, workspaceId])
  @@index([workspaceId])
  @@map("workspace_members")
}

model Project {
  id          String   @id @default(uuid()) @db.Uuid
  workspaceId String   @map("workspace_id") @db.Uuid
  title       String   @db.VarChar(200)
  description String?  @db.Text
  status      String   @default("active") @db.VarChar(20) // active | archived
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  // Relations
  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  tasks     Task[]

  @@index([workspaceId])
  @@map("projects")
}

model Task {
  id          String    @id @default(uuid()) @db.Uuid
  projectId   String    @map("project_id") @db.Uuid
  title       String    @db.VarChar(200)
  description String?   @db.Text
  status      String    @default("todo") @db.VarChar(20) // todo | in_progress | done | cancelled
  priority    String    @default("medium") @db.VarChar(20) // low | medium | high | urgent
  assigneeId  String?   @map("assignee_id") @db.Uuid
  createdById String    @map("created_by_id") @db.Uuid
  dueDate     DateTime? @map("due_date") @db.Timestamptz
  estimatedHours Int?   @map("estimated_hours")
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime  @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  // Relations
  project   Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  assignee  User?     @relation("TaskAssignee", fields: [assigneeId], references: [id], onDelete: SetNull)
  createdBy User      @relation("TaskCreator", fields: [createdById], references: [id])
  comments  Comment[]
  taskLabels TaskLabel[]
  attachments Attachment[]

  @@index([projectId])
  @@index([assigneeId])
  @@index([status])
  @@index([estimatedHours])
  @@map("tasks")
}

model Comment {
  id        String   @id @default(uuid()) @db.Uuid
  taskId    String   @map("task_id") @db.Uuid
  authorId  String   @map("author_id") @db.Uuid
  content   String   @db.Text
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  // Relations
  task   Task @relation(fields: [taskId], references: [id], onDelete: Cascade)
  author User @relation(fields: [authorId], references: [id])

  @@index([taskId])
  @@map("comments")
}

model Label {
  id          String @id @default(uuid()) @db.Uuid
  workspaceId String @map("workspace_id") @db.Uuid
  name        String @db.VarChar(50)
  colour      String @default("#6B7280") @db.VarChar(7) // hex colour
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz

  // Relations
  workspace  Workspace   @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  taskLabels TaskLabel[]

  @@unique([workspaceId, name])
  @@map("labels")
}

model TaskLabel {
  taskId  String @map("task_id") @db.Uuid
  labelId String @map("label_id") @db.Uuid

  task  Task  @relation(fields: [taskId], references: [id], onDelete: Cascade)
  label Label @relation(fields: [labelId], references: [id], onDelete: Cascade)

  @@id([taskId, labelId])
  @@map("task_labels")
}

model Notification {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  type      String   @db.VarChar(50) // task_assigned | comment_added | task_due | mention
  title     String   @db.VarChar(200)
  body      String?  @db.Text
  read      Boolean  @default(false)
  metadata  Json?    @db.JsonB // flexible payload (taskId, commentId, etc.)
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz

  @@index([userId, read])
  @@map("notifications")
}

model Webhook {
  id          String   @id @default(uuid()) @db.Uuid
  workspaceId String   @map("workspace_id") @db.Uuid
  url         String   @db.VarChar(2048)
  secret      String   @db.VarChar(255) // HMAC signing secret
  events      String[] @db.VarChar(50) // task.created, task.updated, comment.added, etc.
  active      Boolean  @default(true)
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz

  // Relations
  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@index([workspaceId])
  @@map("webhooks")
}

model AuditLog {
  id          String   @id @default(uuid()) @db.Uuid
  workspaceId String   @map("workspace_id") @db.Uuid
  userId      String?  @map("user_id") @db.Uuid
  action      String   @db.VarChar(50) // create | update | delete | login | etc.
  resource    String   @db.VarChar(50) // task | project | user | workspace | etc.
  resourceId  String?  @map("resource_id") @db.Uuid
  metadata    Json?    @db.JsonB // before/after values, IP address, etc.
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz

  // Relations
  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  user      User?     @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([workspaceId, createdAt])
  @@index([userId])
  @@map("audit_logs")
}

model Attachment {
  id        String   @id @default(uuid()) @db.Uuid
  taskId    String   @map("task_id") @db.Uuid
  fileName  String   @map("file_name") @db.VarChar(255)
  fileSize  Int      @map("file_size") // bytes
  mimeType  String   @map("mime_type") @db.VarChar(100)
  storageKey String  @map("storage_key") @db.VarChar(500)
  uploadedBy String  @map("uploaded_by") @db.Uuid
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz

  // Relations
  task Task @relation(fields: [taskId], references: [id], onDelete: Cascade)

  @@index([taskId])
  @@map("attachments")
}

```
#### migration.sql

```
-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "estimated_hours" INTEGER;

-- AddConstraint
ALTER TABLE "tasks"
ADD CONSTRAINT "tasks_estimated_hours_check"
CHECK ("estimated_hours" IS NULL OR "estimated_hours" > 0);

-- CreateIndex
CREATE INDEX "tasks_estimated_hours_idx" ON "tasks"("estimated_hours");
```

#### taskService.ts
```
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  task: {
    findUnique: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  comment: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
}));

const serviceMocks = vi.hoisted(() => ({
  sendAssignmentEmailMock: vi.fn(),
}));

serviceMocks.sendAssignmentEmailMock.mockResolvedValue(undefined);

vi.mock("../src/utils/prisma.js", () => ({
  prisma: prismaMock,
}));

vi.mock("../src/services/emailService.js", () => ({
  sendAssignmentEmail: serviceMocks.sendAssignmentEmailMock,
}));

import { updateTask } from "../src/services/taskService.js";

describe("updateTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends an assignment email when a task gets a new assignee", async () => {
    prismaMock.task.findUnique.mockResolvedValue({ assigneeId: null });
    prismaMock.task.update.mockResolvedValue({
      id: "task-1",
      title: "Ship lesson",
      assigneeId: "user-2",
    });
    prismaMock.user.findUnique.mockResolvedValue({
      email: "assignee@example.com",
    });

    const result = await updateTask("task-1", { assigneeId: "user-2" });

    expect(result).toEqual({
      id: "task-1",
      title: "Ship lesson",
      assigneeId: "user-2",
    });
    expect(prismaMock.task.update).toHaveBeenCalledWith({
      where: { id: "task-1" },
      data: {
        assigneeId: "user-2",
        updatedAt: expect.any(Date),
      },
    });
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-2" },
      select: { email: true },
    });
    expect(serviceMocks.sendAssignmentEmailMock).toHaveBeenCalledWith({
      to: "assignee@example.com",
      taskId: "task-1",
      taskTitle: "Ship lesson",
    });
  });

  it("does not send an email when the assignee does not change", async () => {
    prismaMock.task.findUnique.mockResolvedValue({ assigneeId: "user-2" });
    prismaMock.task.update.mockResolvedValue({
      id: "task-1",
      title: "Ship lesson",
      assigneeId: "user-2",
    });

    await updateTask("task-1", { title: "Ship lesson" });

    expect(serviceMocks.sendAssignmentEmailMock).not.toHaveBeenCalled();
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("passes estimated hours through task updates", async () => {
    prismaMock.task.findUnique.mockResolvedValue({ assigneeId: null });
    prismaMock.task.update.mockResolvedValue({
      id: "task-1",
      title: "Ship lesson",
      assigneeId: null,
      estimatedHours: 5,
    });

    const result = await updateTask("task-1", { estimatedHours: 5 });

    expect(result).toEqual({
      id: "task-1",
      title: "Ship lesson",
      assigneeId: null,
      estimatedHours: 5,
    });
    expect(prismaMock.task.update).toHaveBeenCalledWith({
      where: { id: "task-1" },
      data: {
        estimatedHours: 5,
        updatedAt: expect.any(Date),
      },
    });
  });
});
´´´

#### tasks.test.ts
```
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  task: {
    findUnique: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  comment: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock("../src/utils/prisma.js", () => ({
  prisma: prismaMock,
}));

import { app } from "../src/app.js";

describe("task characterisation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when a task is missing", async () => {
    prismaMock.task.findUnique.mockResolvedValue(null);

    const response = await request(app).get(
      "/tasks/00000000-0000-0000-0000-000000000001",
    );

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "not found" });
  });

  it("returns task details with comments and labels", async () => {
    prismaMock.task.findUnique.mockResolvedValue({
      id: "task-1",
      projectId: "project-1",
      title: "Ship lesson",
      description: "Legacy modernisation",
      status: "todo",
      priority: "medium",
      assigneeId: null,
      createdById: "user-1",
      dueDate: null,
      estimatedHours: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      comments: [
        {
          id: "comment-1",
          taskId: "task-1",
          authorId: "user-2",
          content: "Looks good",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
      taskLabels: [
        {
          label: {
            id: "label-1",
            workspaceId: "workspace-1",
            name: "priority",
            colour: "#6B7280",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
          },
        },
      ],
    });

    const response = await request(app).get("/tasks/task-1");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: "task-1",
      projectId: "project-1",
      title: "Ship lesson",
      description: "Legacy modernisation",
      status: "todo",
      priority: "medium",
      assigneeId: null,
      createdById: "user-1",
      dueDate: null,
      estimatedHours: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      comments: [
        {
          id: "comment-1",
          taskId: "task-1",
          authorId: "user-2",
          content: "Looks good",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      labels: [
        {
          id: "label-1",
          workspaceId: "workspace-1",
          name: "priority",
          colour: "#6B7280",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
  });

  it("creates a comment and returns it", async () => {
    prismaMock.comment.create.mockResolvedValue({
      id: "comment-2",
      taskId: "task-1",
      authorId: "user-2",
      content: "Nice work",
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    const response = await request(app)
      .post("/tasks/task-1/comments")
      .send({ authorId: "user-2", content: "Nice work" });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: "comment-2",
      taskId: "task-1",
      authorId: "user-2",
      content: "Nice work",
      createdAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
  });

  it("lists comments for a task", async () => {
    prismaMock.comment.findMany.mockResolvedValue([
      {
        id: "comment-1",
        taskId: "task-1",
        authorId: "user-2",
        content: "Looks good",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);

    const response = await request(app).get("/tasks/task-1/comments");

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        id: "comment-1",
        taskId: "task-1",
        authorId: "user-2",
        content: "Looks good",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
  });

  it("creates a task with estimated hours", async () => {
    prismaMock.task.create.mockResolvedValue({
      id: "task-2",
      projectId: "project-1",
      title: "Draft lesson",
      description: "Write the first pass",
      status: "todo",
      priority: "medium",
      assigneeId: null,
      createdById: "user-1",
      dueDate: null,
      estimatedHours: 4,
      createdAt: new Date("2026-01-03T00:00:00.000Z"),
      updatedAt: new Date("2026-01-03T00:00:00.000Z"),
    });

    const response = await request(app).post("/tasks").send({
      projectId: "00000000-0000-0000-0000-000000000010",
      title: "Draft lesson",
      description: "Write the first pass",
      createdById: "00000000-0000-0000-0000-000000000011",
      estimatedHours: 4,
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: "task-2",
      projectId: "project-1",
      title: "Draft lesson",
      description: "Write the first pass",
      status: "todo",
      priority: "medium",
      assigneeId: null,
      createdById: "user-1",
      dueDate: null,
      estimatedHours: 4,
      createdAt: "2026-01-03T00:00:00.000Z",
      updatedAt: "2026-01-03T00:00:00.000Z",
    });
  });

  it("updates a task's estimated hours", async () => {
    prismaMock.task.findUnique.mockResolvedValue({ assigneeId: null });
    prismaMock.task.update.mockResolvedValue({
      id: "task-1",
      projectId: "project-1",
      title: "Ship lesson",
      description: null,
      status: "todo",
      priority: "medium",
      assigneeId: null,
      createdById: "user-1",
      dueDate: null,
      estimatedHours: 6,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-04T00:00:00.000Z"),
    });

    const response = await request(app)
      .patch("/tasks/task-1")
      .send({ estimatedHours: 6 });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: "task-1",
      estimatedHours: 6,
    });
  });

  it("filters and sorts tasks by estimated hours", async () => {
    prismaMock.task.findMany.mockResolvedValue([
      {
        id: "task-3",
        projectId: "project-1",
        title: "Review lesson",
        description: null,
        status: "todo",
        priority: "medium",
        assigneeId: null,
        createdById: "user-1",
        dueDate: null,
        estimatedHours: 3,
        createdAt: new Date("2026-01-05T00:00:00.000Z"),
        updatedAt: new Date("2026-01-05T00:00:00.000Z"),
      },
    ]);

    const response = await request(app)
      .get("/tasks")
      .query({ estimatedHours: "3", sortBy: "estimatedHours", sortOrder: "desc" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        id: "task-3",
        projectId: "project-1",
        title: "Review lesson",
        description: null,
        status: "todo",
        priority: "medium",
        assigneeId: null,
        createdById: "user-1",
        dueDate: null,
        estimatedHours: 3,
        createdAt: "2026-01-05T00:00:00.000Z",
        updatedAt: "2026-01-05T00:00:00.000Z",
      },
    ]);
    expect(prismaMock.task.findMany).toHaveBeenCalledWith({
      where: { estimatedHours: 3 },
      orderBy: { estimatedHours: "desc" },
    });
  });

  it.each([
    ["-5"],
    ["banana"],
  ])("rejects invalid estimated hours query input %s", async (estimatedHours) => {
    const response = await request(app)
      .get("/tasks")
      .query({ estimatedHours });

    expect(response.status).toBe(400);
    expect(prismaMock.task.findMany).not.toHaveBeenCalled();
  });

  it("rejects invalid estimated hours input", async () => {
    const response = await request(app).post("/tasks").send({
      projectId: "00000000-0000-0000-0000-000000000010",
      title: "Draft lesson",
      createdById: "00000000-0000-0000-0000-000000000011",
      estimatedHours: 0,
    });

    expect(response.status).toBe(400);
    expect(prismaMock.task.create).not.toHaveBeenCalled();
  });
});

```

## Validation

- Executed "taskService.test.ts", "tasks.test.ts"
- Validation passed: the focused task tests, npm run typecheck, and the full npm test suite. I left the unrelated pre-existing worktree changes alone.
- Validation passed with npm test -- tasks.test.ts tests/taskService.test.ts and npm run typecheck.

## Evaluation

- The implementation matches the agreed estimation-feature specification after the two clarifications recorded in the execution log: `estimatedHours` is treated as a positive whole number, and the new list endpoint uses flat query parameters for filtering and sorting.
- I did not see any hallucinated imports or obviously incorrect API usage in the documented changes. The agent worked with the existing Prisma, Express, and Vitest stack rather than introducing a new abstraction.
- The agent followed TundraBoard's existing patterns reasonably well. The changes are split along the expected boundaries: Prisma schema and migration, service logic, route handling, and tests.
- In a real code review, I would tighten the contract around `GET /tasks` further by spelling out the exact query parameter names and sort order semantics, and I would make the validation tests assert the edge cases for fractional values if those are meant to be rejected.
