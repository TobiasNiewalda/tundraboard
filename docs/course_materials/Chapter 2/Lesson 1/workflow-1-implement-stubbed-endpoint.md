# Workflow: Implement a Stubbed Endpoint

## Trigger
Use this workflow when a route or middleware returns `501`, contains `TODO`, or otherwise advertises unfinished behavior that should be turned into working code.

## Prerequisites/Context
- The target file(s) and current implementation
- One nearby example that follows project conventions
- The expected request/response shape
- Validation, auth, and error-handling rules
- Any database/schema or environment dependencies

## Prompt sequence
1. **Requirements extraction** — **Tool slot:** Slot 3. **Pattern:** CoT
   Prompt: `Think step by step about what <FEATURE> must do in <TARGET_FILE>. Use this context: <PASTE FILES, SCHEMA, AND REQUIREMENTS>. List the required behaviors, edge cases, and any assumptions that must be confirmed before writing code.`

2. **Implementation drafting** — **Tool slot:** Slot 1. **Pattern:** Few-shot
   Prompt: `Here is a working example from this codebase: <PASTE EXAMPLE>. Implement <FEATURE> in <TARGET_FILE> following the same structure, naming, and error format. Keep the public API unchanged.`

3. **Correctness review** — **Tool slot:** Slot 3. **Pattern:** Role-setting
   Prompt: `As a senior reviewer, inspect the proposed implementation for missing validation, broken auth, incorrect status codes, and accidental behavior changes. Call out every concrete defect you find.`

4. **Test alignment** — **Tool slot:** Slot 1. **Pattern:** Few-shot
   Prompt: `Given this implementation and the existing test style: <PASTE TEST EXAMPLE>, write the minimum tests or verification steps needed to prove <FEATURE> works and that the stubbed behavior is gone.`

## Verification checklist
- [ ] The stubbed `501` behavior is removed
- [ ] The implementation matches nearby project conventions
- [ ] Required inputs are validated
- [ ] Errors use the repository’s existing shape and status codes
- [ ] Relevant tests or smoke checks pass
