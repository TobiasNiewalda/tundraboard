import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

import { prisma } from "../utils/prisma.js";

// ---------------------------------------------------------------------------
// Reusable workspace-membership guard (Phase 1 NFR-M.3 / review delta R6).
//
// Two entry points, ONE membership semantic (so it cannot drift):
//   - lookupWorkspaceMembership(userId, workspaceId) — used by handlers that
//     receive the workspace id from a query/body param (the legacy /tasks
//     router) and by the middleware below.
//   - requireWorkspaceMember — Express middleware for routers mounted on
//     /workspaces/:workspaceId (advanced task search).
//
// Error contract (E2 / NFR-S.2, NFR-S.3):
//   - 401 when there is no authenticated user (defensive; authenticate owns this)
//   - 404 for BOTH "workspace does not exist" and "caller is not a member",
//     with identical bodies, so workspace ids cannot be enumerated.
//   - Membership is verified BEFORE any task query — never partial results.
//
// All roles (admin | member | viewer) pass; the role is attached for
// future endpoints to gate on (search itself is read-only).
// ---------------------------------------------------------------------------

const workspaceIdParamSchema = z.string().uuid();

export interface WorkspaceRole {
  role: string;
}

/**
 * True tenant check: WorkspaceMember(userId, workspaceId). Returns the
 * membership (incl. role) or null for unknown workspace / non-member /
 * malformed ids — callers map every null to the SAME 404 (no oracle).
 */
export async function lookupWorkspaceMembership(
  userId: string,
  workspaceId: string,
): Promise<WorkspaceRole | null> {
  if (!workspaceIdParamSchema.safeParse(workspaceId).success) {
    return null;
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId,
      },
    },
    select: { role: true },
  });

  return membership;
}

export async function requireWorkspaceMember(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: "authentication required" });
    return;
  }

  try {
    const parsedWorkspaceId = workspaceIdParamSchema.safeParse(
      req.params.workspaceId,
    );

    if (!parsedWorkspaceId.success) {
      // Malformed ids are indistinguishable from missing ones (E2).
      res.status(404).json({ error: "workspace not found" });
      return;
    }

    const workspaceId = parsedWorkspaceId.data;
    const membership = await lookupWorkspaceMembership(userId, workspaceId);

    if (!membership) {
      // Non-members get the same 404 as a nonexistent workspace (E2).
      res.status(404).json({ error: "workspace not found" });
      return;
    }

    req.workspaceMembership = { userId, workspaceId, role: membership.role };
    next();
  } catch {
    res.status(500).json({ error: "failed to verify workspace membership" });
  }
}
