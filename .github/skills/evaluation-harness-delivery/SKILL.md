---
name: evaluation-harness-delivery
description: Build reproducible AI evaluation harnesses and reviewer-ready evidence packages.
---

# Evaluation Harness Delivery

Use this workflow when implementing an AI evaluation harness, an evaluation
exercise, or a reviewer submission that must prove results rather than merely
link to them.

## 1. Read the real submission contract

Read the lesson, exercise, rubric, and existing implementation completely.
Inspect the exercise's `Submit` section before choosing paths. Record a
checklist with:

- harness interface and output schema;
- golden dataset count, categories, and fields;
- baseline and candidate fixture requirements;
- calibration rows, exact CSV headers, and agreement threshold;
- rubric log format;
- required raw per-item evidence;
- results table and final verdict;
- line and character limits;
- validation, branch, commit, and publication requirements.

Separate two deliverables:

1. **Repository artifacts** used to run and reproduce the work.
2. **Inline submission artifacts** pasted in the required order.

A public branch, file map, or reviewer URL is not a substitute for inline
artifacts when the rubric says to paste source or data.

## 2. Budget context and workers

Use the smallest context that answers the dependency questions:

1. What does the harness read and write?
2. What output schema and invariants must it enforce?
3. Which fixtures and model-family statements are fixed by the exercise?
4. Which repository convention must it match?

Prefer a fast tool-capable worker for deterministic implementation and fixture
work. Use extended thinking only for ambiguous rubric decisions or
cross-artifact reconciliation. Give workers explicit caps: no dependency
installs, no external API calls during local validation, no broad test suites,
and no repeated exploration of already supplied files.

Use one focused review after implementation. Apply no more than one
improvement iteration unless the user explicitly asks for more.

## 3. Implement a reproducible harness

The harness should:

- accept the required dataset and pipeline-output paths;
- parse JSONL/CSV strictly enough to expose malformed evidence;
- emit per-input scores, aggregate pass rate, and confusion-matrix data;
- validate all contract dimensions, not just output shape:
  - exact required sections and step/criterion counts;
  - total word limit;
  - grounding in the input title without invented technical specifics;
  - required British/UK spelling;
  - prompt-injection or refusal behaviour where specified;
- state the evaluated pipeline family and judge family, and ensure they differ;
- provide a deterministic offline mode for local verification;
- implement any documented external judge mode or remove it from the CLI and
  documentation. Do not leave a mode that immediately fails after being
  advertised;
- avoid secrets in source, fixtures, reports, or pasted evidence.

Prefer deriving reports and tables from the harness run. If a human label is
needed, preserve it as an explicit input and never silently replace it with a
machine-generated label.

## 4. Reconcile fixtures and derived evidence

Run the harness on the exact baseline and candidate files that will be
submitted. Then verify:

- candidate fixtures are not accidentally identical to baseline fixtures;
- candidate rows match the exercise appendix when fixed outputs are supplied;
- raw per-item reports equal the harness output for those rows;
- the calibration CSV contains exactly the required rows and headers;
- the agreement count and percentage are calculated from the pasted CSV;
- the rubric log states the same before/after values;
- the results table names every candidate ID and uses the derived verdict;
- the final verdict follows the measured pass rates and does not claim
  improvement when the candidate is worse.

Treat a mismatch as a blocking error. Do not repair evidence by hand without
also fixing the source fixture or generation step.

## 5. Assemble the inline submission

Generate a single copy-ready text artifact in the exercise's required order.
For the common seven-section format, include:

1. harness source plus the judge/pipeline model-family line;
2. exactly ten golden JSONL rows;
3. exactly ten baseline output rows and the producing model line;
4. the raw twenty-row calibration CSV;
5. one rubric iteration-log line per iteration;
6. at least three verbatim raw per-item JSON reports;
7. one results-table row per candidate plus the final verdict.

Measure the final block. Keep it below the exercise's line and character
limits. Validate code fences, JSON, JSONL, CSV, and the section order. Give
the user the inline block itself, not only a path to it.

## 6. Validate and publish

Use targeted checks only:

- syntax/type validation for changed code;
- harness runs for baseline and candidate fixtures;
- JSON/JSONL/CSV parsing;
- raw-report equality checks;
- calibration agreement calculation;
- submission line/character count;
- whitespace and repository status checks.

Create a descriptive branch and stage only scoped files. Commit with the
required trailer and push to `origin`; do not open or merge a pull request
unless requested. Report concrete pre-existing failures separately from
failures introduced by the harness.

## 7. Learn from delivery failures

Common failure patterns to prevent:

- providing links and paths when the reviewer requires pasted content;
- documenting an LLM mode that is not executable;
- copying baseline outputs into the candidate fixture;
- claiming a verdict that contradicts measured reports;
- checking section counts and length but not title grounding or locale;
- reporting an agreement rate that does not equal the raw CSV;
- exceeding submission limits by pasting verbose duplicate evidence.

When one of these occurs, fix the source of truth, regenerate derived
artifacts, rerun the targeted checks, and regenerate the inline submission
rather than patching only the reviewer-facing text.
