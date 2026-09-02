# TundraBoard Reasoning-Budget Policy

## Defaults

IDE autocomplete uses fast generation because inline suggestions must preserve flow and usually follow nearby patterns. Terminal agents use fast generation by default for bounded implementation and verification, escalating per task instead of leaving costly reasoning permanently enabled. Web chat uses fast generation for explanations and deterministic transformations; choose extended thinking only when its answer will direct consequential work.

## Enforceable limits and cost arithmetic

At the lesson's representative £0.012 per 1K reasoning tokens, a 4K-token
extended-thinking cap costs at most about £0.048 in hidden reasoning per prompt,
before visible output and input costs. Each developer may use that 4K cap for up
to ten approved prompts per working day (£0.48 hidden-reasoning spend); for a
six-person team, that is £2.88 per day and about £57.60 across a 20-day month.

Any single prompt above 4K reasoning tokens, more than ten extended-thinking
prompts per developer per day, or a total estimated team spend above £60 per
month requires team-lead approval. A high-effort 16K-token prompt costs about
£0.192 in hidden reasoning alone and is therefore approval-only; the lesson's
worked example estimates its all-in cost at £0.205, or 18.6x fast generation.

## When to use extended thinking

Use extended thinking for multi-file refactors with migration, deployment, and rollback constraints; non-obvious debugging or performance investigations with several plausible causes; security reviews and threat modelling where independent controls may combine unsafely; and novel algorithm, scheduling, or query-design work. The tradeoff is justified when a senior engineer would need substantial uninterrupted reasoning before changing code.

## When not to use extended thinking

Avoid extended thinking for routine CRUD patterned after an existing endpoint, well-defined format or type transformations, bulk mechanical refactors, and latency-sensitive IDE completion. Improve the prompt or add an example before increasing reasoning effort.

## Escalation rule

An interleaved-thinking terminal-agent run starts with a maximum of 10 tool hops
and 2K reasoning tokens per hop. It requires team-lead approval before
exceeding 10 hops, 20K cumulative reasoning tokens, or £0.50 estimated
hidden-reasoning spend. It must stop at 25 tool hops, 50K cumulative reasoning
tokens, or £5 estimated total run cost, whichever comes first, and report the
evidence gathered and its next proposed investigation. At the representative
rate, a six-person team running ten-hop, 2K-token investigations concurrently
would spend about £1.44 in hidden reasoning; allowing all six to reach 25 hops
would be about £3.60 before input and visible-output costs.
