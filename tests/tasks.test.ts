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

    const response = await request(app).get("/tasks").query({
      estimatedHours: "3",
      sortBy: "estimatedHours",
      sortOrder: "desc",
    });

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

  it.each([["-5"], ["banana"]])(
    "rejects invalid estimated hours query input %s",
    async (estimatedHours) => {
      const response = await request(app)
        .get("/tasks")
        .query({ estimatedHours });

      expect(response.status).toBe(400);
      expect(prismaMock.task.findMany).not.toHaveBeenCalled();
    },
  );

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
