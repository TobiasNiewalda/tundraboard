import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  task: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  project: {
    findFirst: vi.fn(),
  },
  workspaceMember: {
    findUnique: vi.fn(),
  },
  comment: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  $queryRaw: vi.fn(),
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

// Security audit remediation #1/#2: the legacy /tasks router now runs the
// REAL authenticate (JWT) and requires a workspace-scoped, membership-
// verified ?workspaceId= on every request. Tests sign genuine tokens with
// the same helper /auth/login is contracted to use.
process.env.JWT_SECRET = "tundraboard-legacy-tasks-test-secret";

import { app } from "../src/app.js";
import { signAuthToken } from "../src/middleware/authenticate.js";

const WORKSPACE_ID = "00000000-0000-4000-8000-0000000000a1";
const OTHER_WORKSPACE_ID = "00000000-0000-4000-8000-0000000000a2";
const USER_ID = "00000000-0000-4000-8000-0000000000b1";

const authHeader = () =>
  `Bearer ${signAuthToken({
    id: USER_ID,
    email: "member@tundra.test",
    displayName: "Member",
  })}`;

const withScope = (qs = "") =>
  `workspaceId=${WORKSPACE_ID}${qs ? `&${qs}` : ""}`;

describe("legacy /tasks router (authenticated + workspace-scoped)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: the caller IS a member of WORKSPACE_ID.
    prismaMock.workspaceMember.findUnique.mockResolvedValue({ role: "member" });
    prismaMock.project.findFirst.mockResolvedValue({ id: "project-1" });
  });

  // ---- the audit's headline attacks: anonymous access must be dead ----

  it("401s the anonymous cross-tenant FTS attack (GET /tasks?q=)", async () => {
    const response = await request(app).get("/tasks?q=invoice");

    expect(response.status).toBe(401);
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
    expect(prismaMock.task.findMany).not.toHaveBeenCalled();
  });

  it("401s anonymous reads and writes on every legacy route", async () => {
    const routes: Array<() => Promise<import("supertest").Response>> = [
      () => request(app).get("/tasks/task-1"),
      () => request(app).patch("/tasks/task-1").send({ title: "x" }),
      () =>
        request(app).post("/tasks").send({
          projectId: "00000000-0000-4000-8000-0000000000d1",
          title: "x",
          createdById: USER_ID,
        }),
      () => request(app).get("/tasks/task-1/comments"),
      () =>
        request(app)
          .post("/tasks/task-1/comments")
          .send({ authorId: USER_ID, content: "hi" }),
    ];

    for (const call of routes) {
      const response = await call();
      expect(response.status).toBe(401);
    }

    expect(prismaMock.task.findMany).not.toHaveBeenCalled();
  });

  it("400s requests that omit the mandatory ?workspaceId", async () => {
    const response = await request(app)
      .get("/tasks")
      .set("Authorization", authHeader());

    expect(response.status).toBe(400);
    expect(prismaMock.task.findMany).not.toHaveBeenCalled();
  });

  it("404s non-members and unknown workspaces identically (E2)", async () => {
    prismaMock.workspaceMember.findUnique.mockResolvedValue(null);

    const asOutsider = await request(app)
      .get(`/tasks?${withScope()}`)
      .set("Authorization", authHeader());

    const asGhost = await request(app)
      .get(`/tasks?workspaceId=${OTHER_WORKSPACE_ID}`)
      .set("Authorization", authHeader());

    expect(asOutsider.status).toBe(404);
    expect(asGhost.status).toBe(404);
    expect(asGhost.body).toEqual(asOutsider.body);
    expect(prismaMock.task.findMany).not.toHaveBeenCalled();
  });

  // ---- characterization behavior, preserved behind the new guards ----

  it("returns 404 when a task is missing in the scoped workspace", async () => {
    prismaMock.task.findFirst.mockResolvedValue(null);

    const response = await request(app)
      .get(`/tasks/00000000-0000-0000-0000-000000000001?${withScope()}`)
      .set("Authorization", authHeader());

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "not found" });
  });

  it("returns task details with comments and labels", async () => {
    prismaMock.task.findFirst.mockResolvedValue({
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
      comments: [],
      taskLabels: [],
    });

    const response = await request(app)
      .get(`/tasks/task-1?${withScope()}`)
      .set("Authorization", authHeader());

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: "task-1",
      title: "Ship lesson",
      comments: [],
      labels: [],
    });
    // Scope rides through the service query (relation filter).
    expect(prismaMock.task.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "task-1", project: { workspaceId: WORKSPACE_ID } },
      }),
    );
  });

  it("creates a comment and returns it (task must be in the workspace)", async () => {
    prismaMock.task.findFirst.mockResolvedValue({
      id: "task-1",
      assigneeId: null,
    });
    prismaMock.comment.create.mockResolvedValue({
      id: "comment-2",
      taskId: "task-1",
      authorId: "user-2",
      content: "Nice work",
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    const response = await request(app)
      .post(`/tasks/task-1/comments?${withScope()}`)
      .set("Authorization", authHeader())
      .send({ authorId: "user-2", content: "Nice work" });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ id: "comment-2" });
  });

  it("404s a comment write against a foreign task", async () => {
    prismaMock.task.findFirst.mockResolvedValue(null);

    const response = await request(app)
      .post(`/tasks/task-999/comments?${withScope()}`)
      .set("Authorization", authHeader())
      .send({ authorId: "user-2", content: "hi" });

    expect(response.status).toBe(404);
    expect(prismaMock.comment.create).not.toHaveBeenCalled();
  });

  it("lists comments for a task", async () => {
    prismaMock.task.findFirst.mockResolvedValue({
      id: "task-1",
      assigneeId: null,
    });
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

    const response = await request(app)
      .get(`/tasks/task-1/comments?${withScope()}`)
      .set("Authorization", authHeader());

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
  });

  it("creates a task inside the verified workspace", async () => {
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

    const response = await request(app)
      .post(`/tasks?${withScope()}`)
      .set("Authorization", authHeader())
      .send({
        projectId: "00000000-0000-4000-8000-000000000010",
        title: "Draft lesson",
        description: "Write the first pass",
        createdById: "00000000-0000-4000-8000-000000000011",
        estimatedHours: 4,
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ id: "task-2", estimatedHours: 4 });
  });

  it("400s a create targeting a project outside the workspace", async () => {
    prismaMock.project.findFirst.mockResolvedValue(null);

    const response = await request(app)
      .post(`/tasks?${withScope()}`)
      .set("Authorization", authHeader())
      .send({
        projectId: "00000000-0000-4000-8000-00000000ffff",
        title: "Cross-tenant insert",
        createdById: USER_ID,
      });

    expect(response.status).toBe(400);
    expect(prismaMock.task.create).not.toHaveBeenCalled();
  });

  it("updates a task's estimated hours", async () => {
    prismaMock.task.findFirst.mockResolvedValue({ assigneeId: null });
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
      .patch(`/tasks/task-1?${withScope()}`)
      .set("Authorization", authHeader())
      .send({ estimatedHours: 6 });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: "task-1", estimatedHours: 6 });
  });

  it("filters and sorts tasks within the workspace scope", async () => {
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
      .get(
        `/tasks?${withScope("estimatedHours=3&sortBy=estimatedHours&sortOrder=desc")}`,
      )
      .set("Authorization", authHeader());

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(prismaMock.task.findMany).toHaveBeenCalledWith({
      where: {
        project: { workspaceId: WORKSPACE_ID },
        estimatedHours: 3,
      },
      orderBy: { estimatedHours: "desc" },
    });
  });

  it("scopes the full-text branch of the legacy list too", async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);

    const response = await request(app)
      .get(`/tasks?${withScope("q=lesson")}`)
      .set("Authorization", authHeader());

    expect(response.status).toBe(200);
    const callArgs = prismaMock.$queryRaw.mock.calls[0];
    const queryText = JSON.stringify(callArgs);
    expect(queryText).toContain("workspace_id =");
    expect(queryText).toContain("search_vector @@ websearch_to_tsquery");
  });

  it.each([["-5"], ["banana"]])(
    "rejects invalid estimated hours query input %s",
    async (estimatedHours) => {
      const response = await request(app)
        .get(`/tasks?${withScope(`estimatedHours=${estimatedHours}`)}`)
        .set("Authorization", authHeader());

      expect(response.status).toBe(400);
      expect(prismaMock.task.findMany).not.toHaveBeenCalled();
    },
  );

  it("rejects invalid estimated hours input", async () => {
    const response = await request(app)
      .post(`/tasks?${withScope()}`)
      .set("Authorization", authHeader())
      .send({
        projectId: "00000000-0000-4000-8000-000000000010",
        title: "Draft lesson",
        createdById: "00000000-0000-4000-8000-000000000011",
        estimatedHours: 0,
      });

    expect(response.status).toBe(400);
    expect(prismaMock.task.create).not.toHaveBeenCalled();
  });

  it("advertises the deprecation on legacy responses", async () => {
    prismaMock.task.findMany.mockResolvedValue([]);

    const response = await request(app)
      .get(`/tasks?${withScope()}`)
      .set("Authorization", authHeader());

    expect(response.status).toBe(200);
    expect(response.headers["deprecation"]).toBe("true");
  });
});
