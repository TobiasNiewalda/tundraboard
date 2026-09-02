# Task 01 — Fast generation

**Task:** Routine generation — add a `POST /workspaces/:workspaceId/labels` endpoint following established TundraBoard API conventions.
**Model:** GPT-5.4 Mini, low reasoning effort
**Wall-clock latency:** 20 seconds

## Prompt

> Task: Routine generation — add a POST /workspaces/:workspaceId/labels endpoint following the established TundraBoard API conventions.
>
> Inspect the repository's existing routes, Prisma schema, validation, authentication and authorisation middleware, error handling, and tests. Then provide the exact implementation changes and focused tests needed to add POST /workspaces/:workspaceId/labels. Preserve the repository's existing conventions. Do not modify files. State assumptions only when the repository does not establish the needed behaviour. Limit the response to 450 words.

## LLM response

Implement these changes:

1. `src/routes/labels.ts`
- Import `Router`, `Request`, `Response`, `authenticate`, `prisma`, and `zod`.
- Add `labelCreateSchema = z.object({ name: z.string().trim().min(1).max(50), colour: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional() })`.
- Add `router.post("/workspaces/:workspaceId/labels", authenticate, async (req, res, next) => { ... })`.
- Flow:
  - Parse `workspaceId` from `req.params`.
  - Validate body with Zod; return `400` on validation failure.
  - Ensure `req.user` exists; otherwise `401`.
  - Confirm workspace exists; return `404` if not.
  - Confirm authenticated user is a workspace member; if not, return `403`.
  - Enforce unique label name within workspace; on Prisma unique violation return `409`.
  - Create label with explicit allowlist: `{ workspaceId, name, colour ?? "#6B7280" }`.
  - Return `201` with the created label.
- Preserve existing label-router conventions for future `/labels/:id` endpoints.

2. `src/app.ts`
- No change needed if the route is defined with the full path in `labels.ts`.
- If you prefer nested-router style, mount `app.use("/workspaces/:workspaceId/labels", labelRouter)` and define `router.post("/")`; either approach is acceptable, but use one consistently.

3. `src/middleware/authenticate.ts`
- Must be fully implemented for the route to be usable.
- It should read `Authorization: Bearer <token>`, verify with `JWT_SECRET`, attach `req.user`, and return `401` for missing/invalid/expired tokens.

4. Error handling
- Keep using the global `errorHandler`.
- For Prisma duplicate errors, map to `409` with a clear message.
- For invalid workspace/label references, return `404`/`422` consistently with the repo’s current status-code patterns.

Focused tests to add:
- `tests/labels.test.ts`
  - `201` creates a label in a workspace.
  - `400` rejects invalid `name` / invalid `colour`.
  - `401` when no bearer token is supplied.
  - `403` when the authenticated user is not a workspace member.
  - `404` when `workspaceId` does not exist.
  - `409` when label name already exists in that workspace.

Assumption: since auth/workspace routes are still stubs, these tests should mock `authenticate` and Prisma where needed, and assert the endpoint contract rather than database integration.
