# Optimise Context for a Multi-File Refactoring Task

Apply context management strategies to a multi-file refactoring task in TundraBoard, comparing the impact of different context approaches on AI output quality.

What to do:

1. Choose a refactoring task: Select a function in TundraBoard that spans multiple files — for example, the task endpoint you built in Module 1 (route → service → validation → Prisma model) or any code that touches at least three files. If you have not yet built any endpoints beyond the starter code, complete Module 1 Exercise 5 first.

2. Context experiment: Run the same refactoring prompt three times with different context strategies:
    - A. Minimal context: Include only the function to refactor, with no surrounding context
    - B. Full context: Include all related files in their entirety
    - C. Targeted context: Use the context budget framework — include the function, relevant types/signatures, one convention example, and specific instructions

3. Compare results: For each approach, evaluate the AI's output on:
    - Correctness (does it compile? does it work?)
    - Convention adherence (does it follow project patterns?)
    - Completeness (does it handle edge cases?)
    - Token cost (estimate the input tokens for each approach)

4. Document your strategy: Write a context management guide (one page) for TundraBoard that your team could follow. Include: when to use full-file vs targeted context, how to identify relevant dependencies, and token budget guidelines for different task types.

Submit: Your three prompts and the AI's responses for each context strategy, a comparison of the three strategies across correctness, convention adherence, completeness, and token cost, and the context management guide.