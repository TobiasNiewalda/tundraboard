import { prisma } from "../utils/prisma.js";

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

export async function getCommentsByTaskId(taskId: string): Promise<TaskComment[]> {
  return prisma.comment.findMany({
    where: { taskId },
    orderBy: { createdAt: "asc" },
  });
}

export async function createComment(input: CreateCommentInput): Promise<TaskComment> {
  return prisma.comment.create({
    data: {
      taskId: input.taskId,
      authorId: input.authorId,
      content: input.content,
    },
  });
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
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    comments: task.comments,
    labels: task.taskLabels.map(({ label }) => label),
  };
}
