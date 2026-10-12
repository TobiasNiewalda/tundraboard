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
