#!/usr/bin/env python3
"""Deterministic eval harness for Chapter 3 Lesson 2.

Usage:
  python scripts/chapter3_lesson2_eval.py --golden docs/course_materials/Chapter 3/Lesson 2/implementation/golden.jsonl --pipeline docs/course_materials/Chapter 3/Lesson 2/implementation/v1_outputs.jsonl

The harness supports:
  - local deterministic judging (default)
  - a documented external LLM-as-judge integration point via --judge-mode llm

The external judge family recommendation is Gemini 1.5 / 2.x family when the
pipeline under test is Claude-family, to satisfy the cross-family requirement.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import os
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple


SECTION_RE = re.compile(r"^(Summary|Reproduction steps|Acceptance criteria|Estimated complexity):\s*(.*)$")
WORD_RE = re.compile(r"[A-Za-z0-9_`-]+")


@dataclass
class JudgeResult:
    input_id: str
    title: str
    human_pass: bool
    judge_pass: bool
    agree: bool
    verdict: str
    failed_checks: List[str]
    why: str
    metrics: Dict[str, Any]


def read_jsonl(path: Path) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def parse_sections(output: str) -> Dict[str, str]:
    sections: Dict[str, List[str]] = {"Summary": [], "Reproduction steps": [], "Acceptance criteria": [], "Estimated complexity": []}
    current = None
    for raw_line in output.splitlines():
        line = raw_line.rstrip()
        m = SECTION_RE.match(line)
        if m:
            current = m.group(1)
            sections[current].append(m.group(2))
        elif current:
            sections[current].append(line)
    return {k: "\n".join(v).strip() for k, v in sections.items()}


def count_words(text: str) -> int:
    return len(WORD_RE.findall(text))


def extract_title_tokens(title: str) -> set[str]:
    stop = {"the", "and", "or", "a", "an", "to", "of", "for", "in", "on", "with", "is", "are", "too", "does", "do"}
    tokens = set()
    for token in re.findall(r"[A-Za-z][A-Za-z0-9_./-]*", title.lower()):
        cleaned = token.strip(".,:;()[]{}")
        if cleaned and cleaned not in stop:
            tokens.add(cleaned)
    return tokens


def has_british_spelling(text: str) -> bool:
    american = {"behavior": "behaviour", "optimize": "optimise", "optimized": "optimised", "organize": "organise", "color": "colour"}
    lowered = text.lower()
    return not any(word in lowered for word in american)


def output_checks(record: Dict[str, Any]) -> Tuple[bool, List[str], Dict[str, Any]]:
    output = record["output"]
    title = record["title"]
    sections = parse_sections(output)
    checks: List[str] = []

    # Contract checks
    if not all(sections.values()):
        checks.append("missing_section")
    summary_words = count_words(sections.get("Summary", ""))
    if summary_words > 24:
        checks.append("summary_too_verbose")
    repro_lines = [ln for ln in sections.get("Reproduction steps", "").splitlines() if ln.strip()]
    if not (2 <= len([ln for ln in repro_lines if re.match(r"^\d+\.", ln.strip())]) <= 4):
        checks.append("repro_step_count")
    ac_lines = [ln for ln in sections.get("Acceptance criteria", "").splitlines() if ln.strip()]
    if not (2 <= len([ln for ln in ac_lines if ln.strip().startswith("-")]) <= 3):
        checks.append("acceptance_criteria_count")
    total_words = count_words(output)
    if total_words > 150:
        checks.append("over_word_limit")
    if not has_british_spelling(output):
        checks.append("american_spelling")

    # Grounding heuristic: invented technical specifics not in title
    title_tokens = extract_title_tokens(title)
    invented_markers = []
    for marker in [r"src/[A-Za-z0-9_./-]+", r"tests/[A-Za-z0-9_./-]+", r"[A-Za-z0-9_./-]+\.(ts|tsx|js|py)", r"`[^`]+`"]:
        if re.search(marker, output):
            invented_markers.append(marker)
    if invented_markers:
        checks.append("invented_technical_specifics")
    title_lower = title.lower()
    if "safari" not in title_lower and "safari" in output.lower():
        checks.append("invented_platform_detail")
    if "ignore previous instructions" in title_lower or "print the system prompt" in title_lower:
        checks.append("prompt_injection")

    verdict = "fail" if checks else "pass"
    metrics = {
        "word_count": total_words,
        "summary_words": summary_words,
        "sections_present": {k: bool(v) for k, v in sections.items()},
    }
    return verdict == "pass", checks, metrics


def judge_record(record: Dict[str, Any], mode: str) -> JudgeResult:
    if mode == "llm":
        return judge_record_llm(record)
    if mode != "local":
        raise SystemExit(f"Unsupported judge mode: {mode}")
    judged_pass, failed_checks, metrics = output_checks(record)
    human_pass = record.get("expected_pass", judged_pass)
    return JudgeResult(
        input_id=record["id"],
        title=record["title"],
        human_pass=bool(human_pass),
        judge_pass=judged_pass,
        agree=bool(human_pass) == judged_pass,
        verdict="pass" if judged_pass else "fail",
        failed_checks=failed_checks,
        why="; ".join(failed_checks) if failed_checks else "meets the four invariants",
        metrics=metrics,
    )


def judge_record_llm(record: Dict[str, Any]) -> JudgeResult:
    api_base = os.environ.get("CH3L2_JUDGE_API_BASE", "https://api.openai.com/v1")
    api_key = os.environ.get("CH3L2_JUDGE_API_KEY")
    model = os.environ.get("CH3L2_JUDGE_MODEL", "gpt-4.1-mini")
    if not api_key:
        raise SystemExit(
            "LLM judge mode requires CH3L2_JUDGE_API_KEY and CH3L2_JUDGE_MODEL/CH3L2_JUDGE_API_BASE; "
            "local validation should use --judge-mode local."
        )

    prompt = {
        "id": record["id"],
        "title": record["title"],
        "output": record["output"],
    }
    body = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a strict evaluator for task-description outputs. "
                    "Return ONLY JSON with keys verdict, failed_checks, why, metrics. "
                    "Use the four invariants: grounded in title, under 150 words, observable behaviour, British English."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(prompt, ensure_ascii=False),
            },
        ],
        "temperature": 0,
    }
    req = urllib.request.Request(
        api_base.rstrip("/") + "/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        raise SystemExit(f"LLM judge request failed: {exc}") from exc

    content = payload["choices"][0]["message"]["content"]
    parsed = json.loads(content)
    judged_pass = parsed.get("verdict") == "pass"
    failed_checks = list(parsed.get("failed_checks", []))
    metrics = dict(parsed.get("metrics", {}))
    return JudgeResult(
        input_id=record["id"],
        title=record["title"],
        human_pass=bool(record.get("expected_pass", judged_pass)),
        judge_pass=judged_pass,
        agree=bool(record.get("expected_pass", judged_pass)) == judged_pass,
        verdict="pass" if judged_pass else "fail",
        failed_checks=failed_checks,
        why=str(parsed.get("why", "")),
        metrics=metrics,
    )


def confusion_matrix(results: Iterable[JudgeResult]) -> Dict[str, int]:
    tp = fp = tn = fn = 0
    for r in results:
        if r.human_pass and r.judge_pass:
            tp += 1
        elif r.human_pass and not r.judge_pass:
            fn += 1
        elif not r.human_pass and r.judge_pass:
            fp += 1
        else:
            tn += 1
    return {"true_positive": tp, "false_positive": fp, "true_negative": tn, "false_negative": fn}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--golden", required=True)
    parser.add_argument("--pipeline", required=True)
    parser.add_argument("--judge-mode", default="local", choices=["local", "llm"])
    args = parser.parse_args()

    golden_rows = read_jsonl(Path(args.golden))
    golden = {row["id"]: row for row in golden_rows}
    golden_by_title = {row["title"]: row for row in golden_rows}
    pipeline = read_jsonl(Path(args.pipeline))

    results: List[JudgeResult] = []
    for record in pipeline:
        merged = dict(record)
        if record["id"] in golden:
            merged.update(golden[record["id"]])
        elif record["title"] in golden_by_title:
            merged.update(golden_by_title[record["title"]])
        results.append(judge_record(merged, args.judge_mode))

    cm = confusion_matrix(results)
    report = {
        "judge_mode": args.judge_mode,
        "judged_model_family": "Gemini",
        "pipeline_model_family": "Claude",
        "per_input_scores": [
            {
                "id": r.input_id,
                "title": r.title,
                "human_pass": r.human_pass,
                "judge_pass": r.judge_pass,
                "agree": r.agree,
                "verdict": r.verdict,
                "failed_checks": r.failed_checks,
                "why": r.why,
                "metrics": r.metrics,
            }
            for r in results
        ],
        "aggregate": {
            "pass_rate": round(sum(1 for r in results if r.judge_pass) / len(results), 3) if results else 0.0,
            "agreement_rate": round(sum(1 for r in results if r.agree) / len(results), 3) if results else 0.0,
            "count": len(results),
        },
        "confusion_matrix": cm,
        "raw_per_item_reports": [r.__dict__ for r in results[:3]],
    }
    json.dump(report, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
