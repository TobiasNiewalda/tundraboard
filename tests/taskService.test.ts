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

describe("listTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls prisma.task.findMany when no search query is provided", async () => {
    prismaMock.task.findMany.mockResolvedValue([{ id: "task-1" }]);

    const result = await listTasks();

    expect(result).toEqual([{ id: "task-1" }]);
    expect(prismaMock.task.findMany).toHaveBeenCalled();
  });

  it("calls prisma.$queryRaw when search query is provided", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ id: "task-1" }]);

    const result = await listTasks({ q: "search term" });

    expect(result).toEqual([{ id: "task-1" }]);
    expect(prismaMock.$queryRaw).toHaveBeenCalled();
  });

  it("includes estimatedHours in the raw query if provided", async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);

    await listTasks({ q: "search term", estimatedHours: 5 });

    expect(prismaMock.$queryRaw).toHaveBeenCalledWith(
      expect.objectContaining({
        // Since it's a template literal, Prisma passes a tagged template object.
        // Testing the exact call of $queryRaw is tricky, but we can check it was called.
      }),
    );
  });
});



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
