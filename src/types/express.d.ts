// Extend Express Request to include the authenticated user
declare namespace Express {
  interface Request {
    user?: {
      id: string;
      email: string;
      displayName: string;
    };
    // Attached by requireWorkspaceMember after a successful membership check
    // (Phase 1 NFR-M.3): who, in which workspace, and with which role.
    workspaceMembership?: {
      userId: string;
      workspaceId: string;
      role: string;
    };
  }
}
