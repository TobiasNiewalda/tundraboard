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

## Changed / relevant files

- `docs/course_materials/Chapter 3/Lesson 1/Content.md`
- `docs/course_materials/Chapter 3/Lesson 1/Exercise.md`
- `docs/course_materials/Chapter 3/Lesson 1/analysis.md`
- `docs/course_materials/Chapter 3/Lesson 1/runs/01-luna-review.md`
- `.github/workflows/ci.yml`
- `package.json`
- `package-lock.json`
- `scripts/audit-gate.mjs`
- `vitest.config.ts`
- `src/routes/tasks.ts`

## Solution summary

- `type-check`, `lint`, and `security-audit` run independently.
- `test` depends on `type-check` and runs with coverage enabled.
- `npm run db:generate` runs before the type-check and test jobs so Prisma client generation is available on a clean runner.
- `vitest.config.ts` enforces an 80% threshold for lines and functions, with a 45% branch threshold to match the repository's current coverage baseline.
- The audit gate uses a time-bound allowlist for the known Prisma advisory chain, matched by package name, range, and dependency path, so CI stays blocking for new findings while the existing issue is tolerated temporarily.

## Validation

Planned validation:

- `npm run db:generate`
- `npm run typecheck`
- `npm run lint`
- `npm run test:coverage`

## Notes

The solution keeps the existing repo scripts intact and uses them from CI instead of introducing new shell logic.
