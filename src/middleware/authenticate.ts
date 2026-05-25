import type { Request, Response, NextFunction } from "express";

// ---------------------------------------------------------------------------
// TODO: Implement JWT authentication middleware
//
// This middleware should:
// 1. Extract the JWT token from the Authorization header (Bearer <token>)
// 2. Verify the token using the JWT_SECRET environment variable
// 3. Decode the token payload and attach the user to req.user
// 4. Return 401 if the token is missing, expired, or invalid
//
// Hint: Use the `jsonwebtoken` package (already in dependencies).
// ---------------------------------------------------------------------------

export function authenticate(_req: Request, res: Response, _next: NextFunction): void {
  res.status(501).json({ error: { message: "Authentication not implemented" } });
}
