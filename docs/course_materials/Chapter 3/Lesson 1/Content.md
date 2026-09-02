# Verification Is Not Optional

*Updated 13 April 2026 --- initial creation.*

AI-generated code needs verification at every stage. Relying on "it looks right" is insufficient — you need automated checks that catch issues before they reach code review, and quality gates that prevent them from reaching production.

This lesson teaches you to build a verification workflow that integrates AI output with linters, type checkers, test runners, and static analysis tools.

**By the end of this lesson, you will be able to:**

- Build a multi-stage verification pipeline (type check → lint → format → tests → security scan)
- Configure CI/CD quality gates that block merge on critical issues
- Integrate AI output with verification tools at the earliest possible point

## The Verification Pipeline

A verification pipeline runs multiple checks in sequence, each catching a different class of issue:

| Stage | Tool | What it catches | Speed |
| --- | --- | --- | --- |
| Type check | `tsc --noEmit` | Type errors, missing imports, wrong argument types | Seconds |
| Lint | ESLint | Code quality issues, unused variables, dangerous patterns | Seconds |
| Format | Prettier | Inconsistent formatting | Seconds |
| Tests | Vitest / Jest | Functional regressions, logic errors | Seconds to minutes |
| Security scan | `npm audit`, Snyk, or similar | Known vulnerabilities in dependencies | Seconds |

### The Key Insight

Each tool catches issues that the others miss:

- Type checkers catch wrong argument types but not logic errors
- Linters catch dangerous patterns but not broken business logic
- Tests catch regressions but not security vulnerabilities
- Security scanners catch known CVEs but not custom vulnerabilities

You need all of them. No single tool is sufficient.

> **Try it yourself:** Run each stage of the verification pipeline on TundraBoard. How many issues does each stage find? Which stage found the most critical issues?

## Building a Pre-Commit Verification Script

Automate your verification pipeline with a script that runs before every commit. This catches issues at the earliest possible point.

```bash
#!/bin/bash
set -e

echo "=== Type checking ==="
npx tsc --noEmit

echo "=== Linting ==="
npx eslint src/ --max-warnings 0

echo "=== Formatting ==="
npx prettier --check src/

echo "=== Tests ==="
npx vitest run --reporter=verbose

echo "=== Dependency audit ==="
npm audit --audit-level=high

echo "✅ All checks passed"
```

## Integrating AI Output with Verification

When you generate code with AI, run this pipeline immediately — before you even read the generated code in detail. If it fails at the type-checking stage, you know the AI generated code with type errors, and you can fix them (or regenerate) before investing time in a detailed review.

This "fail fast" approach saves significant time:

1. Generate code with AI
2. Run `tsc --noEmit` — fix any type errors
3. Run ESLint — fix any lint warnings
4. Run tests — investigate any failures
5. Now do your detailed review on verified code

> **Try it yourself:** Generate a new function for TundraBoard using your IDE tool (e.g., a utility function for formatting dates or validating UUIDs). Before reading the code, run `tsc --noEmit` and ESLint on it. Did the AI-generated code pass both checks on the first try?

## Quality Gates for Pull Requests

Verification should also happen at the pull request level, enforced by your CI/CD pipeline. Quality gates prevent code from being merged unless it passes all checks.

### Essential PR Quality Gates

| Gate | What it checks | Enforcement |
| --- | --- | --- |
| **Type check passes** | No TypeScript errors | CI blocks merge on failure |
| **Lint passes** | No lint warnings (zero-warning policy) | CI blocks merge on failure |
| **Tests pass** | All tests green | CI blocks merge on failure |
| **Coverage threshold** | New code has test coverage above a minimum (e.g., 80%) | CI blocks merge if below threshold |
| **Security scan** | No high/critical vulnerability in dependencies | CI blocks merge on failure |
| **Peer review** | At least one human approval | Branch protection rule |

### Setting Up Quality Gates

For GitHub-based projects (like TundraBoard), quality gates are configured through:

- **GitHub Actions**: CI workflows that run on every push and PR
- **Branch protection rules**: Require status checks to pass and peer review before merging
- **Required checks**: Specify which CI jobs must pass

A minimal GitHub Actions workflow for TundraBoard:

```yaml
name: CI
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npx eslint src/ --max-warnings 0
      - run: npx vitest run
      - run: npm audit --audit-level=high
```

### Job structure: parallel vs sequential

The minimal workflow above runs everything in one job. For larger codebases, split the pipeline into parallel and sequential pieces:

```yaml
jobs:
  type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npx tsc --noEmit
  lint:
    runs-on: ubuntu-latest
    steps: [ ...same setup..., npx eslint ... ]
  test:
    needs: type-check  # don't bother running tests if types are broken
    runs-on: ubuntu-latest
    steps: [ ...same setup..., npx vitest run --coverage ]
```

Use `needs:` to declare dependencies. **Type check and lint are independent** — run in parallel. **Tests depend on type check** — no point running tests against code that does not compile. **Security audit is independent** — run in parallel with everything.

### Coverage as a quality gate

AI-generated code is particularly likely to lack edge-case coverage. A coverage gate forces tests for the missing paths. Configure in `vitest.config.ts`:

```ts
export default defineConfig({
  test: {
    coverage: {
      thresholds: { lines: 80, branches: 80, functions: 80 }
    }
  }
})
```

Then in CI: `npx vitest run --coverage` — fails the job if any threshold is breached.

> **Try it yourself:** Write a GitHub Actions workflow file for TundraBoard that runs the complete verification pipeline. Use job parallelism where stages are independent, sequencing where they depend on each other, and add a coverage gate. The exercise asks for this exact structure.

*Module 4 Lesson 4 covers AI-agent-specific CI patterns — permissions for agents that post PR comments, GITHUB_TOKEN scoping for unattended agent runs, secret rotation. The basic CI patterns above are independent of AI usage and apply universally.*

## Common Mistakes

1. **Treating verification as a final step** — Run verification after every AI code generation, not just before committing. The earlier you catch issues, the less time you waste.
2. **Allowing lint warnings to accumulate** — A zero-warning policy keeps the codebase clean. If you allow warnings, they grow until no one reads them.
3. **Skipping type checking for "quick" changes** — Type errors compound. A missed type error in one function causes cascading failures in dependent code.
4. **Not testing AI-generated test code** — AI-generated tests can have incorrect assertions. Verify that tests actually test what they claim to test.

## Key Takeaways

- A verification pipeline catches issues at multiple levels: types, lint, format, tests, and security
- Run the pipeline immediately after AI code generation — before detailed review
- Quality gates on pull requests prevent unverified code from reaching production
- No single verification tool is sufficient — each catches different classes of issues
- Automate verification with pre-commit scripts and CI workflows

## Retrieval Questions

1. What are the five stages of a verification pipeline, and what class of issues does each catch?
2. Why should you run verification immediately after AI code generation rather than waiting until commit time?
3. What are the essential quality gates for pull requests?
4. Why is a zero-warning lint policy important?
