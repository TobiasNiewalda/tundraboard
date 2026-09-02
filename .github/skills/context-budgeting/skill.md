---
name: context-budgeting
description: Shape prompts with just enough repo context, conventions, and evidence for the task.
---

# Context Budgeting

Use this skill when building prompts for code, docs, or agent runs.

## Default rule

Start with the target, then add only direct dependencies, one convention example, and explicit instructions. Do not include full files unless the whole file is the subject of the task.

For snippet-level prompting, prefer exact interfaces, type signatures, and 2-3 line patterns over whole file blocks. If an example body is not necessary to answer the task, omit it.

## Prompt selection

- **Full file** when the AI is editing or judging the whole file.
- **Interface-only** when it needs types, signatures, or contracts but not bodies.
- **Targeted snippet** when one function or block is enough.

## Dependency check

Before expanding context, ask:

1. What does this code read or write?
2. What types or interfaces does it use?
3. What functions or routes does it call?
4. What convention must it match?

If a snippet answers those questions, stop there.

## Budget guidance

- Local helper / small fix: 200-400 input tokens
- One function plus direct types: 500-1,500 input tokens
- Narrow multi-file refactor: 1,500-4,000 input tokens
- Migration, debugging, or security-sensitive work: only widen further when the missing dependency changes the answer

## Practical rules

- Prefer snippets over whole files when the pattern is stable.
- Trim targeted prompts to the smallest interface or snippet that resolves the dependency; avoid carrying unused route stubs or implementation bodies.
- Include one example of the style you want followed.
- Keep prompts and comparisons identical across mode tests.
- Record what context was added and why, so later runs can reuse the same budget.
