# Task 01 — Extended thinking

**Task:** Routine generation — add a `POST /workspaces/:workspaceId/labels` endpoint following established TundraBoard API conventions.
**Model:** GPT-5.4 Mini, high reasoning effort
**Wall-clock latency:** 10 seconds

## Prompt

> Task: Routine generation — add a POST /workspaces/:workspaceId/labels endpoint following the established TundraBoard API conventions.
>
> Inspect the repository's existing routes, Prisma schema, validation, authentication and authorisation middleware, error handling, and tests. Then provide the exact implementation changes and focused tests needed to add POST /workspaces/:workspaceId/labels. Preserve the repository's existing conventions. Do not modify files. State assumptions only when the repository does not establish the needed behaviour. Limit the response to 450 words.

## LLM response

I can’t verify the repo’s exact file names here, so below is the minimal change set to add `POST /workspaces/:workspaceId/labels` in the existing TundraBoard style.

### Implementation changes
1. **Route**
   - Add a workspace-scoped POST route in the existing workspace router:
     - `POST /workspaces/:workspaceId/labels`
   - Chain the same middleware pattern used elsewhere:
     - auth/session middleware
     - workspace authorization middleware (must verify the caller can access the workspace)
     - request validation middleware

2. **Validation**
   - Params:
     - `workspaceId: string` (UUID/ID format matching the rest of the API)
   - Body:
     - `name: string` required, trimmed, non-empty
     - optionally `color: string` if labels support it elsewhere; otherwise omit
   - Enforce the same schema library already used in the project (likely Zod).

3. **Authorization**
   - Reuse existing workspace membership/role checks.
   - If the user cannot access the workspace, return the repo’s standard `403`/`404` response shape (whichever the project uses for unauthorized workspace access).

4. **Handler logic**
   - Look up workspace by `workspaceId`; if not found, return standard `404`.
   - Create the label with `workspaceId` foreign key.
   - Preserve existing naming rules (normalize/trim name).
   - If labels are unique per workspace, rely on Prisma unique constraint and map duplicate to the repo’s conflict validation response (`409` or `422`, per existing convention).

5. **Prisma**
   - No schema change if `Label` already exists with `workspaceId`.
   - If absent, add:
     - `workspaceId` relation
     - `name`
     - unique constraint on `(workspaceId, name)` if that is the existing product rule.

### Focused tests
1. **Success**
   - authenticated workspace member/admin can create a label
   - response includes created label fields and correct `workspaceId`

2. **Validation**
   - missing `name` → `400`
   - empty/whitespace `name` → `400`
   - invalid `workspaceId` → `400`

3. **Auth**
   - unauthenticated request → existing auth error
   - user not in workspace → existing authorization error

4. **Conflict**
   - duplicate label name in same workspace → conflict/validation error matching current conventions

5. **Persistence**
   - label is actually inserted with the workspace relation

If you want, I can turn this into a file-by-file patch plan once you share the relevant route/schema files.
