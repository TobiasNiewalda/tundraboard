---
name: html-to-markdown-exercise-prep
description: Convert copied HTML lesson blocks into clean Markdown Content and Exercise drafts.
---

# HTML to Markdown Exercise Prep

Use this skill when the user pastes lesson content or exercise text copied from an HTML page, especially when it is wrapped in one or more `div` elements with class names.

## Goal

Turn the visible text content into Markdown, ignoring presentation-only HTML. Then split the result into:

- **Content** — lesson or explanatory material
- **Exercise** — the task to be solved

## Process

1. Remove layout wrappers, classes, ids, and presentational attributes.
2. Preserve semantic structure from headings, paragraphs, lists, tables, links, code, and emphasis.
3. Convert the visible text into Markdown using the least-surprising structure.
4. If the source clearly contains both lesson body and task prompt, separate them into `Content` and `Exercise`.
5. If the separation is ambiguous, ask for clarification instead of guessing.
6. Keep the wording faithful to the source. Do not invent missing requirements or rewrite the task intent.
7. Return a clean Markdown draft suitable for `Content.md` and `Exercise.md`.

## Output format

Provide:

- `Markdown Content`
- `Markdown Exercise`
- `Extraction notes` only when needed, for example when structure had to be inferred or stripped HTML changed the meaning
