# Template: Test an Endpoint with Vitest + Supertest

## Purpose

Write endpoint tests that match the existing TundraBoard test style.

## Variables

- `{{ENDPOINT}}`: The route to test
- `{{SOURCE_ROUTE}}`: The route file or handler under test
- `{{MOCKS}}`: The mocks needed for Prisma or other dependencies
- `{{SUCCESS_CASE}}`: The happy-path response to assert
- `{{ERROR_CASES}}`: The negative cases to cover
- `{{EXAMPLE_TEST}}`: One existing test file to copy conventions from

## Prompt

You are writing endpoint tests for TundraBoard.

Use this existing test file as the style reference:

{{EXAMPLE_TEST}}

Target endpoint:

{{ENDPOINT}}

Source route:

{{SOURCE_ROUTE}}

Set up the necessary mocks:

{{MOCKS}}

Write Vitest + Supertest tests that cover the happy path:

{{SUCCESS_CASE}}

And these error cases:

{{ERROR_CASES}}

Keep the assertions explicit and match the repo's JSON response shape exactly.

## Expected Output

A test file with describe/it blocks, clear mock setup, and status/body assertions for the endpoint.

## Notes

- Reuse the repository's test fixture patterns
- Serialize dates to ISO strings in expected bodies when needed
- Include at least one negative case so the route contract is pinned down
