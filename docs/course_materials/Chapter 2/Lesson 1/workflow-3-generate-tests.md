# Workflow: Generate Tests for New Behavior

## Trigger
Use this workflow when a feature, fix, or API change needs repeatable test coverage.

## Prerequisites/Context
- The behavior description or bug report
- The target module and relevant dependencies
- Existing test style, fixtures, and helpers
- Success cases, failure cases, and edge cases

## Prompt sequence
1. **Test matrix** — **Tool slot:** Slot 3. **Pattern:** CoT
   Prompt: `Think step by step about the minimum test matrix for <BEHAVIOR> in <TARGET_MODULE>. Include success paths, failure paths, edge cases, and any regression checks implied by the requirement.`

2. **Test drafting** — **Tool slot:** Slot 1. **Pattern:** Few-shot
   Prompt: `Here is a representative test from this codebase: <PASTE EXAMPLE>. Write tests for <BEHAVIOR> in <TEST_FILE> using the same style and helpers. Cover the test matrix without unnecessary mocking.`

3. **Brittleness review** — **Tool slot:** Slot 3. **Pattern:** Role-setting
   Prompt: `As a QA-minded reviewer, inspect the tests for fragile assertions, missing cleanup, timing risks, and untested branches. Flag anything that could make the suite flaky or misleading.`

4. **Coverage confirmation** — **Tool slot:** Slot 1. **Pattern:** Few-shot
   Prompt: `Compare each test to the requirement and the bug risk. List any missing scenario and explain whether it is essential or optional.`

## Verification checklist
- [ ] The tests cover the expected success path
- [ ] At least one failure or edge case is included
- [ ] Assertions are stable and specific
- [ ] The tests follow project conventions
- [ ] The tests fail for the right reason if the behavior regresses
