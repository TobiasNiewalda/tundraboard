# Workflow: [Name]

## Trigger

When to use this workflow.

## Prerequisites

What you need before starting (files, context, access).

## Steps

1. **[Phase name]** — Tool: [slot]. Pattern: [CoT/few-shot/role].
   - Prompt template: [the actual prompt with placeholders]
   - Expected output: [what good output looks like]

2. **[Phase name]** — ...

## Verification Checklist

- [ ] Check 1
- [ ] Check 2

## Notes

Lessons learned, common pitfalls, edge cases.

!!!
Common Mistakes

    Over-engineering workflows too early — Do not formalise a pattern after using it once. Wait until you have done it at least three times and understand the variations.

    Making workflows too rigid — A good workflow provides structure but allows judgement. Include decision points ("If the resource has file uploads, add step 3b") rather than trying to cover every case.

    Not updating workflows — A workflow that references outdated tools, deprecated APIs, or old coding conventions causes more harm than having no workflow at all. Review quarterly.

    Keeping workflows private — If you have a workflow that saves you 30 minutes per endpoint, your entire team benefits from it. Share workflows actively.

Key Takeaways

    Systematic workflows transform ad-hoc prompting successes into repeatable, consistent processes
    A workflow has four components: trigger, context, prompt sequence, and verification
    Document workflows in a structured format that your team can find and follow
    Iterate on workflows after every few uses — they are living documents
    Wait for three repetitions before formalising a pattern

!!!
