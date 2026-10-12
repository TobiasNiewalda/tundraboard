# Chapter 4 Lesson 3 — Multi-Model Strategy Solution

## Quick scan of the development stages

The lesson's development pipeline stages are:

- Inline completions
- Feature implementation
- Code review
- PR description / summary
- Security scanning
- Test generation
- Architecture discussion
- Documentation generation

## Assumptions used for the cost model

- Team size: 10 developers
- Working month: 20 days
- PR volume: 5 PRs per developer per day
- Pricing source: current OpenRouter model list for Qwen and OpenAI-compatible Luna/Astra pricing on 2026-10-12
- Cost formula: `(input_tokens * prompt_price + output_tokens * completion_price) / 1_000_000`

### Current list prices used

| Model | Role | Prompt price | Completion price |
| --- | --- | ---: | ---: |
| Qwen 3.8 Flash | Quick tier | $0.15 / 1M | $0.47 / 1M |
| GPT-5.6 Luna | Generation tier | $0.20 / 1M | $1.20 / 1M |
| GPT-6 Astra Pro | Higher reasoning tier | $10.00 / 1M | $50.00 / 1M |

## 1) Pipeline map

| Stage | Tier | Suggested model | Why this tier fits | Estimated tokens / interaction | Frequency |
| --- | --- | --- | --- | ---: | --- |
| Inline completions | Quick | Qwen 3.8 Flash | Latency-sensitive; the task is pattern continuation, not deep reasoning | 120 input / 40 output | ~40 / developer / day |
| Feature implementation | Generation | GPT-5.6 Luna | Good quality/speed balance for coding and drafting | 1,800 input / 750 output | ~5 / developer / day |
| Code review | Reasoning | GPT-6 Astra Pro | Needs deeper analysis, bug spotting, and multi-step judgment | 6,000 input / 1,500 output | ~5 / PR / developer / day |
| PR description / summary | Generation | GPT-5.6 Luna | Mostly formatting and summarisation | 1,500 input / 400 output | ~5 / PR / developer / day |
| Security scanning | Reasoning | GPT-6 Astra Pro | Security work should err on the side of depth | 7,000 input / 1,200 output | ~5 / PR / developer / day |
| Test generation | Generation | GPT-5.6 Luna | Boilerplate and pattern expansion are enough | 2,500 input / 1,200 output | ~5 / PR / developer / day |
| Architecture discussion | Reasoning | GPT-6 Astra Pro | Trade-off analysis and system design need deeper reasoning | 3,000 input / 1,200 output | ~1 / developer / day |
| Documentation generation | Generation | GPT-5.6 Luna | Writing and formatting work well with generation-tier models | 1,000 input / 500 output | ~2 / developer / day |

## 2) Cost calculations

### Per-developer interactive usage per month

Assuming 20 working days:

- Inline completions: 96,000 input / 32,000 output
- Feature implementation: 180,000 input / 75,000 output
- Architecture discussion: 60,000 input / 24,000 output
- Documentation: 40,000 input / 20,000 output

| Strategy | Monthly cost per developer | Notes |
| --- | ---: | --- |
| All reasoning | $11.31 | Highest quality, but massively overkill for routine work |
| All generation | $0.26 | Cheapest, but not good enough for review/security/architecture |
| Mixed (recommended) | $1.99 | Matches tier to task |

### CI/CD pipeline AI cost per month

Per PR:

- PR summary: 1,500 input / 400 output
- Test generation: 2,500 input / 1,200 output
- Code review: 6,000 input / 1,500 output
- Security scan: 7,000 input / 1,200 output

This is 17,000 input / 4,300 output tokens per PR.

With 10 developers and 5 PRs per developer per day:

- 50 PRs per day
- 1,000 PRs per month

| Strategy | Monthly CI/CD cost | Notes |
| --- | ---: | --- |
| All reasoning | $385.00 | Best quality, but expensive |
| All generation | $8.56 | Too weak for review and security |
| Mixed (recommended) | $267.72 | Reasoning only where it matters |

### Team total per month

| Strategy | Interactive spend | CI/CD spend | Team total |
| --- | ---: | ---: | ---: |
| All reasoning | $113.10 | $385.00 | $498.10 |
| All generation | $2.56 | $8.56 | $11.12 |
| Mixed (recommended) | $19.87 | $267.72 | $287.59 |

### Recommendation

The mixed strategy costs about 58% of the all-reasoning approach while keeping reasoning-tier models only for the stages where quality matters most. All-generation is cheaper, but it is not acceptable for code review, security scanning, or architecture work.

## 3) Budget guardrails

### Per-developer daily caps

| Tier | Daily cap | Fallback behavior |
| --- | ---: | --- |
| Quick | 5,000 input / 2,000 output | Fall back to cached snippets and template completions first |
| Generation | 12,000 input / 6,000 output | Prune context, then downgrade low-risk drafting to quick tier |
| Reasoning | 4,000 input / 2,000 output | Prune context first; if still over budget, queue the request or require lead approval |

### Pipeline-stage budgets

| Stage | Budget per request | Budget rule |
| --- | ---: | --- |
| Inline completions | 600 input / 200 output | Keep prompts tiny and local |
| Feature implementation | 2,500 input / 900 output | Use interface-only context when possible |
| Code review | 7,000 input / 2,000 output | Include only changed files plus relevant rules |
| Security scanning | 8,000 input / 1,500 output | Prefer pruned context over broad repo dumps |
| PR summary | 2,000 input / 500 output | Summaries should stay short |
| Test generation | 3,000 input / 1,500 output | Generate one test file or one scenario at a time |
| Architecture discussion | 4,000 input / 1,500 output | Use structured prompts with the minimum design context |
| Documentation | 1,500 input / 600 output | Keep drafts concise and formatted |

### Alert thresholds

- Warning at 80% of the monthly team budget
- Lead review at 90%
- Hard stop at 100% unless the request is explicitly approved

If I budget this team at $400/month, the alert points become:

- Warning: $320
- Lead review: $360
- Hard stop: $400

### Fallback chains

- Quick tier: Qwen 3.8 Flash -> cached completions/templates -> generation only if the task cannot be satisfied locally
- Generation tier: GPT-5.6 Luna -> Qwen 3.8 Flash for boilerplate -> queue if the prompt still exceeds budget
- Reasoning tier: GPT-6 Astra Pro -> GPT-6 Luna for non-security review tasks -> human review or queue for security-critical work

## 4) Cost optimisation plan

| Optimisation | What changes | Estimated monthly reduction | Why it helps |
| --- | --- | ---: | --- |
| Context pruning | Send only changed files, interfaces, and relevant policy context | ~$40-$45 | Input tokens dominate reasoning-stage cost |
| Prompt caching | Keep stable instructions and conventions at the start of repeated prompts | ~$25-$35 | PR review and security prompts reuse the same prefix |
| Response length control | Ask for short summaries and targeted outputs | ~$10-$20 | Cuts visible output tokens, especially in summaries and docs |

These savings overlap, so they should not be added mechanically. Applied together, they should move the team noticeably below the baseline mixed-strategy spend.

## Final answer

Use Qwen 3.8 Flash for latency-sensitive autocomplete, GPT-5.6 Luna for implementation, summaries, tests, and documentation, and GPT-6 Astra Pro for code review, security scanning, and architecture work. Put strong budgets and cache-friendly prompt structure around the pipeline, then monitor spend per developer, per pipeline stage, and per model.
