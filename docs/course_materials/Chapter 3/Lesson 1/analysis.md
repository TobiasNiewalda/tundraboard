# Chapter 3 Lesson 1 analysis

## Base lesson context used

Lesson 1 focuses on verification as a first-class part of AI-assisted development. The solution needs to show the full pipeline, not just a single CI job.

## Deliverables

| File                                                   | Purpose                                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------ |
| `.github/workflows/ci.yml`                             | Split the verification pipeline into parallel jobs with dependency edges |
| `vitest.config.ts`                                     | Add coverage thresholds so the CI job can enforce a gate                 |
| `docs/course_materials/Chapter 3/Lesson 1/Content.md`  | Normalised lesson content                                                |
| `docs/course_materials/Chapter 3/Lesson 1/Exercise.md` | Normalised exercise prompt                                               |

## Solution summary

- `type-check`, `lint`, and `security-audit` run independently.
- `test` depends on `type-check` and runs with coverage enabled.
- `npm run db:generate` runs before the type-check and test jobs so Prisma client generation is available on a clean runner.
- `vitest.config.ts` enforces an 80% threshold for lines and functions, with a 45% branch threshold to match the repository's current coverage baseline.

## Validation

Planned validation:

- `npm run db:generate`
- `npm run typecheck`
- `npm run lint`
- `npm run test:coverage`

## Notes

The solution keeps the existing repo scripts intact and uses them from CI instead of introducing new shell logic.
