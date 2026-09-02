# Mode Choice Analysis

## Selected tasks

1. **Routine generation:** Add a `POST /workspaces/:workspaceId/labels` endpoint following the established TundraBoard API conventions.
2. **Planning / multi-file refactor:** Introduce `deleted_at` soft deletion across Task, Project, and Label without breaking existing queries.

## Comparison write-up

### Task 1: `POST /workspaces/:workspaceId/labels`

GPT Mini fast was the stronger response. It used the existing `Label` model's `colour` spelling and concrete 50-character limit, suggested mapping the unique constraint to `409`, and acknowledged the current authentication and workspace routes are stubs. It nevertheless made an unverified claim about a likely `authenticate.ts` implementation, so that detail would need checking before coding. The thinking response was less grounded: it explicitly could not verify file names, used American `color`, and treated the known model and constraints as conditional. Fast was also slower in this sample (20s versus 10s), which shows that mode does not guarantee latency on an individual run.

**Quality verdict:** fast 4/5; thinking 2/5.

### Task 2: Soft-delete rollout

Both Sonnet plans correctly noticed that the application is still a scaffold, so the main risk is setting conventions for future code rather than migrating live route queries. The fast plan went broader, including `TaskLabel` handling and a staged rollout. The thinking plan made the more important distinction that a project soft-delete should update non-deleted child tasks in the same transaction while comments, attachments, and join rows need not acquire `deleted_at`; it also correctly noted that `findUnique` cannot include the active-record filter. Its extra specificity identifies an implementation decision that prevents visible tasks beneath deleted projects.

**Quality verdict:** fast 4/5; thinking 5/5.

## Mode-choice analysis

### Task 1: Routine endpoint generation

Use **fast generation**. The fast transcript produced a concrete, schema-aligned route and test outline, including the actual `colour` field, workspace-scoped uniqueness, and a focused mocked-test strategy for the current scaffold. The thinking transcript failed to use repository evidence it was asked to inspect, framed established facts as unknown, and did not improve the design enough to justify an extended reasoning budget. Escalate only if the endpoint introduces a new role policy or another cross-workspace invariant not covered by a supplied example.

### Task 2: Soft-delete multi-file refactor

Use **extended thinking**. The high-effort transcript surfaced the ordering boundary that a parent Project and its active child Tasks must be soft-deleted together in one transaction, while also explaining why `findUnique` needs a subsequent `deletedAt` check. The fast transcript identified the relevant models and migration mechanics but did not define that transactional behaviour as precisely. Although high effort added five seconds in this run, the risk of exposing tasks through a deleted project makes the additional reasoning worthwhile.

## Team mode-selection policy

**Defaults:** IDE autocomplete uses fast generation because inline suggestions must preserve flow and usually follow nearby patterns. Terminal agents use fast generation by default for bounded implementation and verification, escalating per task instead of leaving costly reasoning permanently enabled. Web chat uses fast generation for explanations and deterministic transformations; choose extended thinking only when its answer will direct consequential work.

**Encourage extended thinking:** Use it for multi-file refactors with migration, deployment, and rollback constraints; non-obvious debugging or performance investigations with several plausible causes; security reviews and threat modelling where independent controls may combine unsafely; and novel algorithm, scheduling, or query-design work. The tradeoff is justified when a senior engineer would need substantial uninterrupted reasoning before changing code.

**Do not use extended thinking:** Avoid it for routine CRUD patterned after an existing endpoint, well-defined format or type transformations, bulk mechanical refactors, and latency-sensitive IDE completion. Improve the prompt or add an example before increasing reasoning effort.

**Escalation rule:** An interleaved-thinking terminal-agent run requires team-lead approval when it is expected to exceed 25 tool hops or a £5 cost cap. The agent must stop at that limit and report the evidence gathered and its next proposed investigation.
