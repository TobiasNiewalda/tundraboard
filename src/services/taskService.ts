import { prisma } from "../utils/prisma.js";
import { sendAssignmentEmail } from "./emailService.js";

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskLabel {
  id: string;
  workspaceId: string;
  name: string;
  colour: string;
  createdAt: Date;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string | null;
  createdById: string;
  dueDate: Date | null;
  estimatedHours: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskDetails extends Task {
  comments: TaskComment[];
  labels: TaskLabel[];
}

export interface CreateCommentInput {
  taskId: string;
  authorId: string;
  content: string;
}

export interface CreateTaskInput {
  projectId: string;
  title: string;
  description?: string | null;
  status?: string;
  priority?: string;
  assigneeId?: string | null;
  createdById: string;
  dueDate?: Date | null;
  estimatedHours?: number | null;
}

export interface ListTasksInput {
  estimatedHours?: number;
  sortBy?: "createdAt" | "estimatedHours";
  sortOrder?: "asc" | "desc";
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: string;
  priority?: string;
  assigneeId?: string | null;
  dueDate?: Date | null;
  estimatedHours?: number | null;
}

interface TaskWithRelations extends Task {
  comments: TaskComment[];
  taskLabels: Array<{
    label: TaskLabel;
  }>;
}

export async function getTask(taskId: string): Promise<TaskDetails> {
  const task = (await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      comments: true,
      taskLabels: {
        include: {
          label: true,
        },
      },
    },
  })) as TaskWithRelations | null;

  if (!task) {
    throw new Error("Task not found");
  }

  return toTaskDetails(task);
}

export async function getCommentsByTaskId(
  taskId: string,
): Promise<TaskComment[]> {
  return prisma.comment.findMany({
    where: { taskId },
    orderBy: { createdAt: "asc" },
  });
}

export async function createComment(
  input: CreateCommentInput,
): Promise<TaskComment> {
  return prisma.comment.create({
    data: {
      taskId: input.taskId,
      authorId: input.authorId,
      content: input.content,
    },
  });
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  return prisma.task.create({
    data: {
      projectId: input.projectId,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? "todo",
      priority: input.priority ?? "medium",
      assigneeId: input.assigneeId ?? null,
      createdById: input.createdById,
      dueDate: input.dueDate ?? null,
      estimatedHours: input.estimatedHours ?? null,
    },
  });
}

export async function listTasks(input: ListTasksInput = {}): Promise<Task[]> {
  return prisma.task.findMany({
    ...(input.estimatedHours !== undefined
      ? { where: { estimatedHours: input.estimatedHours } }
      : {}),
    orderBy: input.sortBy
      ? { [input.sortBy]: input.sortOrder ?? "asc" }
      : { createdAt: "desc" },
  });
}

export async function updateTask(
  id: string,
  data: UpdateTaskInput,
): Promise<Task> {
  const existingTask = await prisma.task.findUnique({
    where: { id },
    select: { assigneeId: true },
  });

  if (!existingTask) {
    throw new Error("Task not found");
  }

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...data,
      updatedAt: new Date(),
    },
  });

  if (data.assigneeId && data.assigneeId !== existingTask.assigneeId) {
    const assignee = await prisma.user.findUnique({
      where: { id: data.assigneeId },
      select: { email: true },
    });

    if (assignee?.email) {
      void sendAssignmentEmail({
        to: assignee.email,
        taskId: task.id,
        taskTitle: task.title,
      }).catch(() => undefined);
    }
  }

  return task;
}

function toTaskDetails(task: TaskWithRelations): TaskDetails {
  return {
    id: task.id,
    projectId: task.projectId,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    assigneeId: task.assigneeId,
    createdById: task.createdById,
    dueDate: task.dueDate,
    estimatedHours: task.estimatedHours,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    comments: task.comments,
    labels: task.taskLabels.map(({ label }) => label),
  };
}
