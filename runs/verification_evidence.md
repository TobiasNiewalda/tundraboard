# Run Verification Evidence

## Runtime measurements

The orchestration runtime reported the following completion times for the four
recorded provider runs:

| Run | Model and mode | Wall-clock latency |
| --- | --- | ---: |
| `task_01_fast` | GPT-5.4 Mini, low reasoning effort | 20 seconds |
| `task_01_thinking` | GPT-5.4 Mini, high reasoning effort | 10 seconds |
| `task_02_fast` | Claude Sonnet 5, low reasoning effort | 39 seconds |
| `task_02_thinking` | Claude Sonnet 5, high reasoning effort | 44 seconds |

The full prompts and responses are preserved in the corresponding run files.
The runtime did not expose provider token-usage or billing telemetry, and no
provider dashboard screenshot was available during this exercise. These
measurements therefore verify completion time, not actual per-run spend.

## Cost-ratio evidence

The lesson's stated representative frontier pricing is approximately £0.012 per
1K output or reasoning tokens. Its worked example prices the same 2,000-token
input and 800-token visible output at £0.011 in fast mode, £0.035 at low-effort
thinking, and £0.205 at high-effort thinking. This yields the following
projected cost ratios:

| Mode | Worked-example cost | Ratio to fast |
| --- | ---: | ---: |
| Fast | £0.011 | 1.0x |
| Low-effort thinking | £0.035 | 3.2x |
| High-effort thinking | £0.205 | 18.6x |

These are planning projections from the lesson material, not a claim about the
actual token consumption of the four runs. Future exercises should attach a
provider usage export or dashboard screenshot when access is available and
record its timestamp, model, input tokens, output tokens, reasoning tokens, and
currency.
