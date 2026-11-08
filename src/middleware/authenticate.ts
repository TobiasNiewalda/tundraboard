import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// ---------------------------------------------------------------------------
// JWT authentication middleware.
//
// Contract (the shape /auth/login MUST sign):
//   payload: { sub: <userId uuid>, email: string, displayName: string }
//   algorithm HS256, secret: JWT_SECRET env var.
//
// Behavior (Phase 1 NFR-S.2):
//   - Missing/foreign `Authorization: Bearer <token>` header  → 401
//   - Signature expired / invalid / malformed token           → 401
//   - Server misconfigured (no JWT_SECRET)                     → 501 fail-closed
//   - Verified: attach { id, email, displayName } to req.user and continue.
//
// Fails CLOSED by design: nothing proceeds without a verified token.
// ---------------------------------------------------------------------------

interface AuthTokenPayload {
  sub?: string;
  email?: string;
  displayName?: string;
}

const BEARER_PREFIX = "Bearer ";

export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    // Misconfiguration must never degrade into an open endpoint.
    res.status(501).json({ error: "authentication is not configured" });
    return;
  }

  const header = req.headers.authorization;

  if (!header || !header.startsWith(BEARER_PREFIX)) {
    res.status(401).json({ error: "authentication required" });
    return;
  }

  const token = header.slice(BEARER_PREFIX.length).trim();

  if (!token) {
    res.status(401).json({ error: "authentication required" });
    return;
  }

  let payload: AuthTokenPayload;

  try {
    payload = jwt.verify(token, secret) as AuthTokenPayload;
  } catch {
    // Expired, forged, or malformed — indistinguishable to the client.
    res.status(401).json({ error: "invalid or expired token" });
    return;
  }

  if (!payload.sub) {
    res.status(401).json({ error: "invalid or expired token" });
    return;
  }

  req.user = {
    id: payload.sub,
    email: payload.email ?? "",
    displayName: payload.displayName ?? "",
  };

  next();
}

/**
 * Sign a session token — the counterpart `POST /auth/login` should use so
 * issuer and verifier cannot drift. Kept here until auth.ts is implemented.
 */
export function signAuthToken(user: {
  id: string;
  email: string;
  displayName: string;
}): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(
    { sub: user.id, email: user.email, displayName: user.displayName },
    secret,
    { algorithm: "HS256", expiresIn: "8h" },
  );
}
