---
name: course-materials-delivery
description: Deliver course exercises efficiently through evidence-driven intake, mode-aware delegation, local-model triage, and safe publication.
---

# Course Materials Delivery

Use this workflow for every course lesson. Optimise for complete, verifiable course artifacts rather than for maximum agent activity.

## 1. Intake and success criteria

1. Locate and read the lesson content and exercise in full. If chapter, lesson, or either input is unavailable, ask the user for the missing item before acting.
2. Convert each explicit requirement into a checklist: required artifacts, experiments, output fields, validations, branch/publish requirements, and exclusions.
3. Inspect the exercise's submission section before prior course-material outputs. Explicit submission paths, including repository-root artifacts, always override an established documentation layout.
4. Before creating files, state the intended artifact paths and the evidence each will contain.

## 2. Select the lowest-cost capable worker

- Invoke every available matching skill before acting; use `mode-aware-orchestrator` whenever work requires sub-agent selection.
- Invoke `context-budgeting` whenever you are deciding prompt shape, context size, or which files/snippets to include.
- Use a tool-capable fast agent for repository discovery, routine document scaffolding, deterministic transformations, and bounded implementation.
- Use a tool-capable thinking agent for ambiguous requirements, multi-file plans, evidence synthesis, security-sensitive analysis, or decisions whose failure would invalidate the exercise.
- Use interleaved tool reasoning only for evidence-driven investigations where each result can alter the next probe. Define a hop or cost cap first.
- Use a local Ollama model only for self-contained, non-tool work: extracting requirements from supplied text, classifying tasks, drafting a document outline, summarising already collected transcripts, or checking a draft against an explicit rubric. Prefer `qwen3.5:4b` for short classification or extraction, `qwen3.5:9b` for longer structured drafts, and `gemma4:e4b` only when its quality is specifically needed.
- Do not give a local non-tool model a task that requires repository inspection, command execution, tool calls, authoritative facts, timing, or final verification. Treat its output as a draft; a tool-capable agent must verify it against source material.

## 3. Execute with evidence

1. Delegate only independent work in parallel. Keep dependent work sequential, carrying forward the relevant evidence rather than asking agents to rediscover it.
2. For a mode comparison, keep the prompt, model family, scope, context, and output limit identical. Record the unmodified prompt, full response, model, reasoning mode, and wall-clock latency for every run.
3. Capture timing from the orchestration runtime rather than estimating it. Never invent outputs, source facts, or measurements.
4. After each material phase, compare results to the intake checklist. Escalate only the deficient part: better context for missing facts, extended thinking for unresolved cross-cutting reasoning, or a new tool-based investigation for missing evidence.
5. Preserve useful intermediate results in course artifacts only when the exercise requires them; otherwise keep the final documentation focused.

## 4. Learn and improve

At the end of every lesson, assess the approach: which mode or worker produced adequate output, which delegation added cost without value, which requirement caused rework, and what was still manual. Incorporate the lesson immediately into the next plan by changing task decomposition, model selection, prompt templates, or validation order.

Suggest a new skill, agent, or MCP server only when a repeated, concrete friction point would be solved by it. State the recurring task, required capability, expected token/time saving, ownership or security implications, and why an existing tool is insufficient. Do not add infrastructure speculatively.

## 5. Validate and publish safely

1. Audit the final artifact checklist, including every explicit submission path, and run the smallest relevant validation.
2. Create a descriptive branch on the user's fork. Stage only files created or changed for the exercise; do not absorb unrelated worktree changes.
3. Commit with the required trailer and push to `origin`. Do not merge or open a pull request unless requested.
4. Report the branch, commit SHA, completed artifacts, validation result, and any concrete automation recommendation.
