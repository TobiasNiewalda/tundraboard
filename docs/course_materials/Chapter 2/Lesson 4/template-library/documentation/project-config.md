# Template: Draft Project-Level AI Configuration

## Purpose

Create a short project-scoped AI instruction file for TundraBoard or a similar codebase.

## Variables

- `{{PROJECT_NAME}}`: The project name
- `{{STACK}}`: The tech stack to describe
- `{{CONVENTIONS}}`: Stable coding conventions to enforce
- `{{CONSTRAINTS}}`: Safety or product constraints
- `{{COMMON_PATTERNS}}`: Repeated structures worth codifying
- `{{TARGET_FILE}}`: The configuration file being drafted (for example CLAUDE.md or AGENTS.md)

## Prompt

You are drafting a project-level AI configuration file for `{{PROJECT_NAME}}`.

Target file:

{{TARGET_FILE}}

Project stack:

{{STACK}}

Stable conventions:

{{CONVENTIONS}}

Constraints:

{{CONSTRAINTS}}

Common patterns:

{{COMMON_PATTERNS}}

Write a focused configuration file that will be read on every interaction. Keep it short, practical, and specific to stable project rules. Do not include transient tasks, sprint notes, or exhaustive documentation.

## Expected Output

A concise markdown file ready to paste into the requested project-scoped config file.

## Notes

- Keep this narrower than normal documentation
- Prefer conventions and constraints over examples
- Update it when the project's stable patterns change
