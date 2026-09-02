# Workflow: Generate a Test Based on a Requirement

## Trigger
Use this workflow when a requirement is approved and needs end-to-end or acceptance test coverage before implementation work begins.

## Prerequisites/Context
- The approved requirement text and description field
- The test framework and directory conventions
- Existing examples of similar end-to-end tests
- Required GIVEN-WHEN-THEN scenario details
- Cleanup, timing, and parallelization constraints

## Prompt sequence
1. **Requirement breakdown** — **Tool slot:** Slot 3. **Pattern:** CoT
   Prompt: `Think step by step about <REQUIREMENT>. List the user-facing outcomes, happy path, failure cases, and the minimum acceptance scenarios that should be covered before implementation starts.`

2. **Scenario selection** — **Tool slot:** Slot 1. **Pattern:** Few-shot
   Prompt: `Here is an existing end-to-end test from this project: <PASTE EXAMPLE>. Generate the smallest set of GIVEN-WHEN-THEN scenarios for <REQUIREMENT> using the same style.`

3. **Test implementation** — **Tool slot:** Slot 1. **Pattern:** Few-shot
   Prompt: `Write the test file for <REQUIREMENT> in <TEST_PATH>. Preserve the project’s framework conventions, helpers, and naming patterns, and keep the test expected to fail until implementation exists.`

4. **Flakiness review** — **Tool slot:** Slot 3. **Pattern:** Role-setting
   Prompt: `As a QA reviewer, inspect the test for timing risks, cleanup problems, parallelization issues, and fragile assertions. State any improvements needed before the test can be relied on.`

## Verification checklist
- [ ] The test maps directly to an approved requirement
- [ ] The GIVEN-WHEN-THEN structure is clear
- [ ] The test uses the project’s actual framework conventions
- [ ] Flaky timing or cleanup risks are addressed
- [ ] The test fails for the right reason until implementation exists
