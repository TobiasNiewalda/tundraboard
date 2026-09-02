# TundraBoard context management guide

## Default rule

Start with the smallest context that still explains the target and its direct dependencies. Add more code only when the model has to reason about cross-file contracts, not just local syntax.

## When to use full-file context

Use full files when the AI is editing the whole file, when the file is short, or when the change depends on several nearby branches of logic that are hard to summarize safely. Full-file context is also appropriate for migration work, security-sensitive changes, or refactors where the file's conventions are the main source of truth.

Do not use full-file context for unrelated route stubs or helper bodies when a contract, type declaration, or short pattern is enough.

## When to use targeted context

Use a targeted snippet when you are changing one function or one block and can name the dependencies precisely. Include:

1. The target function or block.
2. The types and signatures it calls.
3. One small example of the style or pattern to follow.
4. A short instruction block that states the output shape and constraints.

If a dependency does not change the answer, do not include it.

## How to identify relevant dependencies

Ask four questions:

1. What does this code read or write?
2. What types or interfaces does it rely on?
3. What functions or routes does it call?
4. What project convention would make a wrong answer obvious?

If the answer is “none” to all four, the code is probably local enough for a minimal prompt. If the answer is “yes” to any of them, add only the specific snippet that resolves that dependency.

When possible, prefer an exact interface declaration or a 2-3 line pattern over a whole file block.

## Token budget guidelines

| Task type | Recommended budget |
| --- | ---: |
| Single helper, local fix, or autocomplete-style change | 200-400 input tokens |
| One function plus direct types/signatures | 500-1,500 input tokens |
| Multi-file refactor with a narrow scope | 1,500-4,000 input tokens |
| Migration, debugging, security review, or rollback-sensitive change | 4,000+ only with a clear reason |

## Practical rules

- Prefer interface-only context over whole-file dumps when the caller/callee relationship matters more than implementation details.
- Include one convention example whenever the task depends on repo style.
- Start a new conversation for sensitive material instead of accumulating context across turns.
- If the answer starts to speculate about missing files, stop and add the missing dependency rather than widening everything.
