import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  task: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
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

import { listTasks, updateTask } from "../src/services/taskService.js";

// Security audit remediation #1: every legacy service function now REQUIRES
// a workspace scope — there is no unscoped code path left to call.
const WORKSPACE_ID = "00000000-0000-4000-8000-0000000000a1";

describe("listTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls prisma.task.findMany with the workspace scope when no search query", async () => {
    prismaMock.task.findMany.mockResolvedValue([{ id: "task-1" }]);

    const result = await listTasks({ workspaceId: WORKSPACE_ID });

    expect(result).toEqual([{ id: "task-1" }]);
    expect(prismaMock.task.findMany).toHaveBeenCalledWith({
      where: { project: { workspaceId: WORKSPACE_ID } },
      orderBy: { createdAt: "desc" },
    });
  });

  it("calls prisma.$queryRaw when search query is provided", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ id: "task-1" }]);

    const result = await listTasks({
      q: "search term",
      workspaceId: WORKSPACE_ID,
    });

    expect(result).toEqual([{ id: "task-1" }]);
    expect(prismaMock.$queryRaw).toHaveBeenCalled();
  });

  it("includes the workspace predicate in the FTS raw query (NFR-S.1)", async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);

    await listTasks({ q: "search term", workspaceId: WORKSPACE_ID });

    const queryText = JSON.stringify(prismaMock.$queryRaw.mock.calls[0]);
    expect(queryText).toContain("workspace_id =");
    expect(queryText).toContain(WORKSPACE_ID);
  });

  it("includes estimatedHours in the raw query if provided", async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);

    await listTasks({
      q: "search term",
      estimatedHours: 5,
      workspaceId: WORKSPACE_ID,
    });

    expect(prismaMock.$queryRaw).toHaveBeenCalled();
    const callArgs = prismaMock.$queryRaw.mock.calls[0];
    const queryText = JSON.stringify(callArgs);
    expect(queryText).toContain("estimated_hours =");
    expect(queryText).toContain("5");
  });
});

describe("updateTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends an assignment email when a task gets a new assignee", async () => {
    prismaMock.task.findFirst.mockResolvedValue({ assigneeId: null });
    prismaMock.task.update.mockResolvedValue({
      id: "task-1",
      title: "Ship lesson",
      assigneeId: "user-2",
    });
    prismaMock.user.findUnique.mockResolvedValue({
      email: "assignee@example.com",
    });

    const result = await updateTask(
      "task-1",
      { assigneeId: "user-2" },
      WORKSPACE_ID,
    );

    expect(result).toEqual({
      id: "task-1",
      title: "Ship lesson",
      assigneeId: "user-2",
    });
    // Scope check: the existence probe is workspace-filtered (findFirst).
    expect(prismaMock.task.findFirst).toHaveBeenCalledWith({
      where: { id: "task-1", project: { workspaceId: WORKSPACE_ID } },
      select: { id: true, assigneeId: true },
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

  it("404s a task that is not in the caller's workspace", async () => {
    prismaMock.task.findFirst.mockResolvedValue(null);

    await expect(
      updateTask("task-1", { title: "hijack" }, WORKSPACE_ID),
    ).rejects.toThrow("Task not found");
    expect(prismaMock.task.update).not.toHaveBeenCalled();
  });

  it("does not send an email when the assignee does not change", async () => {
    prismaMock.task.findFirst.mockResolvedValue({ assigneeId: "user-2" });
    prismaMock.task.update.mockResolvedValue({
      id: "task-1",
      title: "Ship lesson",
      assigneeId: "user-2",
    });

    await updateTask("task-1", { title: "Ship lesson" }, WORKSPACE_ID);

    expect(serviceMocks.sendAssignmentEmailMock).not.toHaveBeenCalled();
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("passes estimated hours through task updates", async () => {
    prismaMock.task.findFirst.mockResolvedValue({ assigneeId: null });
    prismaMock.task.update.mockResolvedValue({
      id: "task-1",
      title: "Ship lesson",
      assigneeId: null,
      estimatedHours: 5,
    });

    const result = await updateTask(
      "task-1",
      { estimatedHours: 5 },
      WORKSPACE_ID,
    );

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
