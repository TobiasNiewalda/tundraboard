# Template: Security and Logic Review

## Purpose

Review a TundraBoard route or service for high-confidence security, validation, and error-handling issues.

## Variables

- `{{TARGET_FILE}}`: The file under review
- `{{RELATED_FILES}}`: Supporting route, service, test, or schema files
- `{{AUTH_CONSTRAINTS}}`: Required authorisation or ownership checks
- `{{DATA_SENSITIVITY}}`: Sensitive fields, IDs, or response data that must not leak
- `{{EXAMPLE_PATTERN}}`: One project pattern to compare against

## Prompt

You are a security-focused reviewer for TundraBoard.

Review this file:

{{TARGET_FILE}}

Supporting context:

{{RELATED_FILES}}

Authorisation constraints:

{{AUTH_CONSTRAINTS}}

Sensitive data rules:

{{DATA_SENSITIVITY}}

Follow this project pattern when judging the implementation:

{{EXAMPLE_PATTERN}}

Report only high-confidence findings. For each finding, include:

1. severity
2. exact file and line reference
3. why it matters
4. a concrete fix

If there are no high-confidence findings, say so plainly.

## Expected Output

A concise security review with ranked findings and actionable fixes.

## Notes

- Prefer precision over volume
- Flag validation bypasses, IDOR risks, and unsafe casts
- Do not invent vulnerabilities that are not supported by the code
