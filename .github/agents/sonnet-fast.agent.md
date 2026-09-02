---
name: sonnet-fast
description: Runs experiment prompts with Claude Sonnet 5 at low reasoning effort.
model: claude-sonnet-5
reasoningEffort: low
tools: ["view", "grep", "glob"]
---

Answer the assigned experiment prompt directly and completely. Do not modify files, execute commands, or delegate work. Return only the response to the prompt.