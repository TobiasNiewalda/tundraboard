# Full-context run

**Target:** `src/middleware/authenticate.ts`
**Model:** gpt-5.4-mini via `gpt-mini-fast`
**Reasoning:** low
**Latency:** ~60s
**Estimated input tokens:** ~1,900-3,600

## Prompt

~~~text
Refactor the `authenticate` middleware in `src/middleware/authenticate.ts` into a production-ready JWT middleware. Return only the code changes needed, with no explanation. Preserve the repository's TypeScript and Express conventions, and keep the existing 401 error shape if you add one.

Context:
```ts
// src/middleware/authenticate.ts
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

```ts
// src/types/express.d.ts
// Extend Express Request to include the authenticated user
declare namespace Express {
  interface Request {
    user?: {
      id: string;
      email: string;
      displayName: string;
    };
  }
}
```
~~~ts
// src/routes/auth.ts
import { Router } from "express";

export const authRouter = Router();

// ---------------------------------------------------------------------------
// TODO: Implement authentication endpoints
//
// POST /auth/register
//   - Accept: { email, password, displayName }
//   - Hash the password with bcryptjs
//   - Create the user in the database
//   - Return the created user (without password hash)
//
// POST /auth/login
//   - Accept: { email, password }
//   - Verify credentials against the database
//   - Generate a JWT token
//   - Return: { token, user }
//
// Hint: Use zod for input validation, bcryptjs for password hashing,
//       and jsonwebtoken for token generation.
// ---------------------------------------------------------------------------
```

```ts
// src/middleware/errorHandler.ts
import type { ErrorRequestHandler } from "express";

/**
 * Global error handler. Catches errors thrown or passed via next(error)
 * and returns a consistent JSON response.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = err.status ?? err.statusCode ?? 500;
  const message = err.message ?? "Internal server error";

  if (process.env.NODE_ENV !== "test") {
    console.error(`[${status}] ${message}`, err.stack);
  }

  res.status(status).json({
    error: {
      message,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    },
  });
};
```

```ts
// src/app.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { workspaceRouter } from "./routes/workspaces.js";
import { projectRouter } from "./routes/projects.js";
import { taskRouter } from "./routes/tasks.js";
import { commentRouter } from "./routes/comments.js";
import { labelRouter } from "./routes/labels.js";
import { notificationRouter } from "./routes/notifications.js";
import { webhookRouter } from "./routes/webhooks.js";
import { errorHandler } from "./middleware/errorHandler.js";

export const app = express();

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  }),
);
app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use("/health", healthRouter);
app.use("/auth", authRouter);
app.use("/workspaces", workspaceRouter);
app.use("/projects", projectRouter);
app.use("/tasks", taskRouter);
app.use("/comments", commentRouter);
app.use("/labels", labelRouter);
app.use("/notifications", notificationRouter);
app.use("/webhooks", webhookRouter);

// ---------------------------------------------------------------------------
// Error handling (must be last)
// ---------------------------------------------------------------------------
app.use(errorHandler);
```

```json
// package.json
{
  "dependencies": {
    "@prisma/client": "^6.5.0",
    "express": "^4.21.0",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "zod": "^3.24.0",
    "cors": "^2.8.5",
    "helmet": "^8.0.0",
    "morgan": "^1.10.0",
    "dotenv": "^16.4.0"
  }
}
```

## Response

```ts
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
```
