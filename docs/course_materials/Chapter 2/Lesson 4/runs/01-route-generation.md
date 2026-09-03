# Route Generation Template Run

## Template used

`template-library/code-generation/route-create.md`

## Filled prompt

You are implementing a thin Express route for TundraBoard.

Use the existing route example below as the convention reference:

```ts
import { Router } from "express";
import packageJson from "../../package.json";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({
    status: "ok",
    version: packageJson.version,
    timestamp: new Date().toISOString(),
  });
});
```

Relevant source files:

- `src/routes/health.ts`
- `src/app.ts`

Create `healthRouter` with a `GET /ready` handler that follows the same synchronous router style and JSON response conventions as the example.

Requirements:

- Return `status`, `version`, and `timestamp`
- Keep the response shape consistent with the existing health endpoint
- Use the same package version source
- Keep the route thin and avoid introducing extra abstraction unless it is clearly reusable

## AI output

```ts
import { Router } from "express";
import packageJson from "../../package.json";

export const healthRouter = Router();

function buildHealthPayload() {
  return {
    status: "ok",
    version: packageJson.version,
    timestamp: new Date().toISOString(),
  };
}

healthRouter.get("/", (_req, res) => {
  res.json(buildHealthPayload());
});

healthRouter.get("/ready", (_req, res) => {
  res.json(buildHealthPayload());
});
```

## Assessment

This worked well because the template kept the route thin and anchored it to an actual repo example. The output is conventionally correct and easy to read, and the prompt now matches the synchronous health route more closely. The template could still be improved by asking whether a shared helper is desirable before generating one; in this case the helper is reused cleanly, but the prompt should make that decision explicit when the route family grows.
