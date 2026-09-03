# Lesson 4 analysis

## Base lesson context used

Lesson 4 emphasises two durable patterns: turn repeatable workflows into parameterised prompt templates, and keep project-level configuration files short, focused, and convention-heavy. I used that framing to build a reusable template library for TundraBoard instead of a one-off prompt dump.

## Deliverables

| File                                                 | Purpose                                                    |
| ---------------------------------------------------- | ---------------------------------------------------------- |
| `template-library/README.md`                         | Library index and organisation guide                       |
| `template-library/code-generation/route-create.md`   | Template for thin Express route generation                 |
| `template-library/code-generation/service-method.md` | Template for service-layer method generation               |
| `template-library/testing/supertest-endpoint.md`     | Template for route testing with Vitest + Supertest         |
| `template-library/review/security-review.md`         | Template for security and logic review                     |
| `template-library/documentation/project-config.md`   | Template for project-scoped AI config files                |
| `runs/01-route-generation.md`                        | Filled prompt and output for the route-generation template |
| `runs/02-security-review.md`                         | Filled prompt and output for the security-review template  |

## Test run summary

| Template         | Source code used       | Outcome                                                                                   |
| ---------------- | ---------------------- | ----------------------------------------------------------------------------------------- |
| Route generation | `src/routes/health.ts` | Produced a clean Express route draft with the repo's router style and JSON response shape |
| Security review  | `src/routes/tasks.ts`  | Produced a focused review with missing-auth, validation, and error-disclosure findings    |

## What worked well

- The lesson’s template structure translated cleanly into reusable files.
- Keeping the project-config template separate from code-generation templates matched the lesson’s point that global config should stay focused.
- The review template benefited from a severity-first format and explicit line references.

## What I would keep changing

- Route-generation templates should call out whether to extract shared helpers or duplicate tiny response builders.
- Review templates should always ask for exact file/line references so the output stays actionable.
- The config template should stay short; adding project policy beyond conventions starts to look like documentation, not config.

## Reflection

The template-library approach is better than ad-hoc prompting because it makes the input shape explicit before a task starts. The strongest part of the lesson content is the idea that templates and config files are different tools: templates are reusable per-task prompts, while config files are for stable project rules. This submission follows that split directly.
