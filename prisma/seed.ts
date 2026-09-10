import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding TundraBoard database...");

  // --- Users ---
  const passwordHash = await hash("password123", 10);

  const alice = await prisma.user.upsert({
    where: { email: "alice@tundraboard.dev" },
    update: {},
    create: {
      id: randomUUID(),
      email: "alice@tundraboard.dev",
      displayName: "Alice Lindström",
      passwordHash,
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: "bob@tundraboard.dev" },
    update: {},
    create: {
      id: randomUUID(),
      email: "bob@tundraboard.dev",
      displayName: "Bob Virtanen",
      passwordHash,
    },
  });

  const charlie = await prisma.user.upsert({
    where: { email: "charlie@tundraboard.dev" },
    update: {},
    create: {
      id: randomUUID(),
      email: "charlie@tundraboard.dev",
      displayName: "Charlie Eriksson",
      passwordHash,
    },
  });

  console.log(`  Created ${3} users`);

  // --- Workspace ---
  const workspace = await prisma.workspace.upsert({
    where: { slug: "tundraboard-dev" },
    update: {},
    create: {
      id: randomUUID(),
      name: "TundraBoard Development",
      slug: "tundraboard-dev",
    },
  });

  // --- Workspace Members ---
  for (const [user, role] of [
    [alice, "admin"],
    [bob, "member"],
    [charlie, "viewer"],
  ] as const) {
    await prisma.workspaceMember.upsert({
      where: {
        userId_workspaceId: { userId: user.id, workspaceId: workspace.id },
      },
      update: {},
      create: {
        id: randomUUID(),
        userId: user.id,
        workspaceId: workspace.id,
        role,
      },
    });
  }

  console.log(`  Created workspace with 3 members`);

  // --- Projects ---
  const apiProject = await prisma.project.create({
    data: {
      id: randomUUID(),
      workspaceId: workspace.id,
      title: "API Development",
      description:
        "Core TundraBoard REST API — endpoints, services, and middleware.",
      status: "active",
    },
  });

  const frontendProject = await prisma.project.create({
    data: {
      id: randomUUID(),
      workspaceId: workspace.id,
      title: "Frontend",
      description:
        "TundraBoard web application — React dashboard and task management UI.",
      status: "active",
    },
  });

  console.log(`  Created ${2} projects`);

  // --- Tasks ---
  const tasks = [
    {
      projectId: apiProject.id,
      title: "Implement user authentication endpoints",
      description:
        "Add POST /auth/register and POST /auth/login with JWT token generation.",
      status: "in_progress",
      priority: "high",
      assigneeId: alice.id,
      createdById: alice.id,
    },
    {
      projectId: apiProject.id,
      title: "Add input validation to task endpoints",
      description:
        "Use Zod schemas to validate request bodies for POST and PATCH /tasks.",
      status: "todo",
      priority: "high",
      assigneeId: bob.id,
      createdById: alice.id,
    },
    {
      projectId: apiProject.id,
      title: "Set up rate limiting on auth endpoints",
      description:
        "Prevent brute-force attacks by limiting login attempts to 5 per minute per IP.",
      status: "todo",
      priority: "medium",
      assigneeId: null,
      createdById: alice.id,
    },
    {
      projectId: apiProject.id,
      title: "Add workspace-level authorisation checks",
      description:
        "Verify workspace membership before allowing access to projects and tasks.",
      status: "todo",
      priority: "urgent",
      assigneeId: alice.id,
      createdById: alice.id,
    },
    {
      projectId: frontendProject.id,
      title: "Design task board component",
      description:
        "Create a Kanban-style board with columns for todo, in_progress, and done.",
      status: "in_progress",
      priority: "medium",
      assigneeId: bob.id,
      createdById: bob.id,
    },
    {
      projectId: frontendProject.id,
      title: "Add search and filtering to task list",
      description:
        "Allow users to search tasks by title and filter by status, priority, and assignee.",
      status: "todo",
      priority: "low",
      assigneeId: null,
      createdById: alice.id,
      dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days overdue
    },
  ];

  for (const taskData of tasks) {
    await prisma.task.create({
      data: { id: randomUUID(), ...taskData },
    });
  }

  console.log(`  Created ${tasks.length} tasks`);

  // --- Labels ---
  const labels = [
    { name: "bug", colour: "#EF4444" },
    { name: "feature", colour: "#3B82F6" },
    { name: "documentation", colour: "#8B5CF6" },
    { name: "security", colour: "#F59E0B" },
    { name: "performance", colour: "#10B981" },
  ];

  for (const label of labels) {
    await prisma.label.create({
      data: {
        id: randomUUID(),
        workspaceId: workspace.id,
        name: label.name,
        colour: label.colour,
      },
    });
  }

  console.log(`  Created ${labels.length} labels`);
  console.log("\nSeed complete!");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
