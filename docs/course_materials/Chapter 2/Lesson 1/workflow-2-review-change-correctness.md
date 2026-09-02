# Workflow: Review a Change for Correctness and Risk

## Trigger
Use this workflow before merge, handoff, or release whenever a patch introduces code, config, or behavior that could regress existing functionality.

## Prerequisites/Context
- The diff or changed files
- The acceptance criteria or issue description
- A nearby example implementation
- Known constraints such as auth, performance, or data-loss sensitivity

## Prompt sequence
1. **Change summary** — **Tool slot:** Slot 1. **Pattern:** CoT
   Prompt: `Summarize <DIFF_OR_FILES> in plain language. What changed, what behavior is affected, and what assumptions does the patch introduce?`

2. **Defect hunt** — **Tool slot:** Slot 3. **Pattern:** Role-setting
   Prompt: `As a strict code reviewer, look for correctness, security, maintainability, and compatibility issues in <DIFF_OR_FILES>. Prioritize concrete defects over style concerns.`

3. **Requirement cross-check** — **Tool slot:** Slot 1. **Pattern:** Few-shot
   Prompt: `Compare the change against <REQUIREMENTS>. List every place where the implementation does not satisfy the requirement or where the code could fail in production.`

4. **Review report** — **Tool slot:** Slot 1. **Pattern:** Role-setting
   Prompt: `Return a concise review with severity labels, exact file references, and the smallest fix that would resolve each finding.`

## Verification checklist
- [ ] Every requirement is covered
- [ ] No blocking correctness or security issues remain
- [ ] Review findings cite specific files or lines
- [ ] Each finding includes a concrete fix
- [ ] The review distinguishes real defects from preferences
