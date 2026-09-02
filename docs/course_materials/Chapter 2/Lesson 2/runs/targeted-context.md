# Targeted-context run

**Target:** `src/middleware/authenticate.ts`
**Model:** gpt-5.4-mini via `gpt-mini-fast`
**Reasoning:** low
**Latency:** ~60s
**Estimated input tokens:** ~300-700

## Prompt

~~~text
Refactor the `authenticate` middleware in `src/middleware/authenticate.ts` into a production-ready JWT middleware. Return only the code changes needed, with no explanation. Preserve the repository's TypeScript and Express conventions, and keep the existing 401 error shape if you add one.

Use the supplied context to infer the correct implementation:
- `req.user` is declared on `Express.Request` as `{ id: string; email: string; displayName: string } | undefined`
- `errorHandler` follows the pattern `res.status(status).json({ error: { message, ...(dev && { stack }) } })`
- Dependencies already include `jsonwebtoken`

Context:
~~~ts
import type { Request, Response, NextFunction } from "express";

export function authenticate(_req: Request, res: Response, _next: NextFunction): void {
  res.status(501).json({ error: { message: "Authentication not implemented" } });
}
~~~

~~~ts
declare namespace Express {
  interface Request {
    user?: {
      id: string;
      email: string;
      displayName: string;
    };
  }
}
~~~

~~~ts
export const errorHandler = (err, _req, res, _next) => {
  res.status(err.status ?? err.statusCode ?? 500).json({
    error: {
      message: err.message ?? "Internal server error",
    },
  });
};
~~~
~~~

## Response

~~~ts
import type { Request, Response, NextFunction } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";

type AuthTokenPayload = JwtPayload & {
  id?: string;
  email?: string;
  displayName?: string;
  user?: {
    id?: string;
    email?: string;
    displayName?: string;
  };
};

function unauthorized(res: Response): void {
  res.status(401).json({ error: { message: "Unauthorized" } });
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    res.status(500).json({ error: { message: "JWT secret not configured" } });
    return;
  }

  const authorization = req.header("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : undefined;

  if (!token) {
    unauthorized(res);
    return;
  }

  try {
    const decoded = jwt.verify(token, secret) as AuthTokenPayload;
    const user = decoded.user ?? {
      id: decoded.id,
      email: decoded.email,
      displayName: decoded.displayName,
    };

    if (!user.id || !user.email || !user.displayName) {
      unauthorized(res);
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    };

    next();
  } catch {
    unauthorized(res);
  }
}
~~~
