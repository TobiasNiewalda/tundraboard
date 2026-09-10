# Chapter 3 Lesson 2 implementation

## Files

- `scripts/chapter3_lesson2_eval.py` — deterministic offline-safe eval harness
- `golden.jsonl` — 10-row golden set with categories
- `v1_outputs.jsonl` — 10 baseline outputs
- `v2_outputs.jsonl` — appendix outputs copied verbatim
- `calibration.csv` — raw 20-row calibration set
- `rubric_iteration_log.txt` — one-line calibration log
- `v2_raw_reports.json` — three raw per-item reports in harness JSON shape
- `v2_results_table.txt` — verdict table and overall decision

## Commands

```powershell
python scripts/chapter3_lesson2_eval.py --golden "docs/course_materials/Chapter 3/Lesson 2/implementation/golden.jsonl" --pipeline "docs/course_materials/Chapter 3/Lesson 2/implementation/v1_outputs.jsonl"
```

## Judge model and family choice

- Judge model family: Gemini
- Pipeline model family: Claude
- Why different: the lesson requires a cross-family judge so the scorer does not prefer the same house style as the model under test.
- External LLM judge integration point: set `--judge-mode llm` together with `CH3L2_JUDGE_API_KEY`, `CH3L2_JUDGE_MODEL`, and optionally `CH3L2_JUDGE_API_BASE`. The harness uses an OpenAI-compatible `/chat/completions` call and expects the model to return JSON with verdict, failed_checks, why, and metrics.
