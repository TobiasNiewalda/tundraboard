# Minimal-context run

**Target:** `src/middleware/authenticate.ts`
**Model:** gpt-5.4-mini via `gpt-mini-fast`
**Reasoning:** low
**Latency:** ~60s
**Estimated input tokens:** ~200-400

## Prompt

~~~text
Refactor the `authenticate` middleware in `src/middleware/authenticate.ts` into a production-ready JWT middleware. Return only the code changes needed, with no explanation. Preserve the repository's TypeScript and Express conventions, and keep the existing 401 error shape if you add one.

Context:
```ts
import type { Request, Response, NextFunction } from "express";

// ---------------------------------------------------------------------------
// TODO: Implement JWT authentication middleware
//
// This middleware should:
// 1. Extract the JWT token from the Authorization header (******
// 2. Verify the token using the JWT_SECRET environment variable
// 3. Decode the token payload and attach the user to req.user
// 4. Return 401 if the token is missing, expired, or invalid
//
// Hint: Use the `jsonwebtoken` package (already in dependencies).
// ---------------------------------------------------------------------------

export function authenticate(_req: Request, res: Response, _next: NextFunction): void {
  res.status(501).json({ error: { message: "Authentication not implemented" } });
}
```
~~~

## Response

```ts
import type { RequestHandler } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";

type AuthTokenPayload = JwtPayload & {
  user?: {
    id?: string;
    email?: string;
    displayName?: string;
  };
  id?: string;
  email?: string;
  displayName?: string;
};

export const authenticate: RequestHandler = (req, res, next): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: { message: "Unauthorized" } });
    return;
  }

  const token = authHeader.slice(7).trim();
  const secret = process.env.JWT_SECRET;

  if (!secret || !token) {
    res.status(401).json({ error: { message: "Unauthorized" } });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret) as AuthTokenPayload;
    const user = decoded.user ?? decoded;

    if (!user.id || !user.email || !user.displayName) {
      res.status(401).json({ error: { message: "Unauthorized" } });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    };

    next();
  } catch {
    res.status(401).json({ error: { message: "Unauthorized" } });
  }
};
```
