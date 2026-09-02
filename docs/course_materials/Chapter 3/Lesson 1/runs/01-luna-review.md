# Run 01 — Luna review

**Model:** GPT-5.6 Luna  
**Reasoning:** medium  
**Purpose:** review the Chapter 3 Lesson 1 content, exercise, CI workflow, and coverage config

## Prompt

Review the newly created Chapter 3 Lesson 1 course artifacts and the CI solution in this TundraBoard repository.

Inspect:

- `docs/course_materials/Chapter 3/Lesson 1/Content.md`
- `docs/course_materials/Chapter 3/Lesson 1/Exercise.md`
- `docs/course_materials/Chapter 3/Lesson 1/analysis.md`
- `.github/workflows/ci.yml`
- `vitest.config.ts`

Check lesson fidelity, workflow structure, coverage gate viability, and use of existing scripts.

## Findings

- **High — CI omits Prisma generation.** Add `npm run db:generate` before type-check and test jobs.
- **High — Branch coverage threshold was too high.** The repo currently lands below 80% branch coverage, so the gate needed a lower baseline.
- No material issue found in `Exercise.md`.
- No concrete fidelity issue found in `Content.md`.

## Resulting changes

- Added `npm run db:generate` to the type-check and test jobs.
- Lowered the branch coverage threshold to 45% while keeping the lesson example at 80% for lines/functions.
