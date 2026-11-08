import type { NextFunction, Request, RequestHandler, Response } from "express";

// ---------------------------------------------------------------------------
// Per-user fixed-window rate limiter (Phase 1 NFR-S.6: 60 req/min → 429 +
// Retry-After). In-process Map state is sufficient for the single-instance
// deployment this repo targets (no queue/redis estate — Phase 2 §1); a
// multi-instance rollout should swap this for a shared-store limiter with
// the same interface.
// ---------------------------------------------------------------------------

export interface UserRateLimiter {
  /** Middleware: 429 + Retry-After once the window is exhausted. */
  middleware: RequestHandler;
  /** Test/admin hook to clear all windows. */
  reset(): void;
}

export function createUserRateLimiter(options: {
  limit: number;
  windowMs: number;
  message?: string;
}): UserRateLimiter {
  const { limit, windowMs } = options;
  const message = options.message ?? "rate limit exceeded";
  const hits = new Map<string, number[]>();
  let requests = 0;

  // Audit #5c — keys are never implicitly removed; sweep periodically so a
  // long tail of one-off users cannot grow the map without bound.
  const sweepExpired = (now: number) => {
    for (const [key, times] of hits) {
      const alive = times.filter((t) => t > now - windowMs);

      if (alive.length === 0) {
        hits.delete(key);
      } else {
        hits.set(key, alive);
      }
    }
  };

  const middleware: RequestHandler = (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const now = Date.now();
    const windowStart = now - windowMs;
    const key = req.user?.id ?? req.ip ?? "anonymous";

    if (++requests % 1024 === 0) {
      sweepExpired(now);
    }

    // Sliding-window log (not a fixed window): every hit is timestamped and
    // only hits inside the last windowMs count, so boundary bursts are
    // bounded by `limit` per any rolling window.
    const recent = (hits.get(key) ?? []).filter((t) => t > windowStart);

    if (recent.length >= limit) {
      hits.set(key, recent);
      const retryMs = recent[0] + windowMs - now;
      res.setHeader(
        "Retry-After",
        String(Math.max(1, Math.ceil(retryMs / 1000))),
      );
      res.status(429).json({ error: message });
      return;
    }

    recent.push(now);
    hits.set(key, recent);
    next();
  };

  return { middleware, reset: () => hits.clear() };
}
