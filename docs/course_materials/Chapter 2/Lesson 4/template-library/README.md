# TundraBoard Prompt Template Library

This library is organised by task family so developers can find the right prompt shape quickly and keep repeated work consistent.

## Organisation logic

- **code-generation/** — templates that produce or modify implementation code
- **testing/** — templates that create tests or test scaffolding
- **review/** — templates that inspect code for security, correctness, or convention issues
- **documentation/** — templates that produce repo-scoped guidance or configuration

## Index

| File                                | Purpose                                                               |
| ----------------------------------- | --------------------------------------------------------------------- |
| `code-generation/route-create.md`   | Create thin Express route handlers that match TundraBoard conventions |
| `code-generation/service-method.md` | Create service-layer methods that wrap Prisma and business logic      |
| `testing/supertest-endpoint.md`     | Generate Vitest + Supertest coverage for an endpoint                  |
| `review/security-review.md`         | Review a route or service for security and logic issues               |
| `documentation/project-config.md`   | Draft CLAUDE.md / AGENTS.md / copilot-instructions.md content         |

## Maintenance rules

- Keep templates parameterised; do not hard-code specific entity names.
- Update templates when conventions change.
- Use one strong example per family instead of bloating every template.
