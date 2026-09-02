# TundraBoard Reasoning-Budget Policy

## Defaults

IDE autocomplete uses fast generation because inline suggestions must preserve flow and usually follow nearby patterns. Terminal agents use fast generation by default for bounded implementation and verification, escalating per task instead of leaving costly reasoning permanently enabled. Web chat uses fast generation for explanations and deterministic transformations; choose extended thinking only when its answer will direct consequential work.

## When to use extended thinking

Use extended thinking for multi-file refactors with migration, deployment, and rollback constraints; non-obvious debugging or performance investigations with several plausible causes; security reviews and threat modelling where independent controls may combine unsafely; and novel algorithm, scheduling, or query-design work. The tradeoff is justified when a senior engineer would need substantial uninterrupted reasoning before changing code.

## When not to use extended thinking

Avoid extended thinking for routine CRUD patterned after an existing endpoint, well-defined format or type transformations, bulk mechanical refactors, and latency-sensitive IDE completion. Improve the prompt or add an example before increasing reasoning effort.

## Escalation rule

An interleaved-thinking terminal-agent run requires team-lead approval when it is expected to exceed 25 tool hops or a £5 cost cap. The agent must stop at that limit and report the evidence gathered and its next proposed investigation.
