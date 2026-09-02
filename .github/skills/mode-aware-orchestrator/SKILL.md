---
name: mode-aware-orchestrator
description: Orchestrate sub-agents with deliberate fast, extended-thinking, and interleaved-thinking mode selection.
---

# Mode-Aware Orchestration

Choose a sub-agent's reasoning mode from the task's uncertainty, branching, and consequence—not from a global preference.

## Select the mode deliberately

- Use **fast generation** for routine implementation, deterministic transformations, established patterns, bulk operations, and latency-sensitive work. Give the agent precise context and examples rather than extra reasoning budget.
- Use **extended thinking** for multi-file planning, non-obvious debugging, security-sensitive reasoning, novel algorithms, or changes with consequential deployment and rollback constraints. Start with the smallest useful reasoning budget and increase only when the result is demonstrably incomplete.
- Use **interleaved thinking with tools** only when each tool result can materially alter the next investigative step. Set a total cost or hop limit before starting. Do not use it for deterministic read-transform-write chains or broad mechanical edits.

## Orchestrate safely and efficiently

1. Classify the work before delegating: routine, deterministic transformation, planning/refactor, debugging/investigation, security review, or novel design.
2. Split only independent work into parallel sub-agents. Keep dependent work sequential and pass the prior result as explicit context.
3. For mode comparisons, run the same prompt, scope, repository context, and requested output shape in both modes. Record the model, mode, full prompt, complete response, and wall-clock latency for every run.
4. Give fast agents bounded, pattern-based tasks. Give thinking agents a specific decision or risk to resolve; do not use higher effort to compensate for missing requirements.
5. Review sub-agent outputs against the task's success criteria. Escalate from fast to extended thinking only when unresolved cross-cutting risks, ambiguous evidence, or failed validation justify the additional cost and latency.
6. For an interleaved run, require the agent to state its current hypothesis after material tool results, revise its plan when evidence contradicts it, and stop at the configured hop or cost limit.

## Report the mode decision

For each delegated task, state the selected mode, why it fits the task, the evidence that would justify escalation, and any cap on thinking effort, tool hops, or cost.
