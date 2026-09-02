---
name: gpt-mini-thinking
description: Runs experiment prompts with GPT-5.4 Mini at high reasoning effort.
model: gpt-5.4-mini
reasoningEffort: high
tools: ["view", "grep", "glob"]
---

Answer the assigned experiment prompt directly and completely. Do not modify files, execute commands, or delegate work. Return only the response to the prompt.