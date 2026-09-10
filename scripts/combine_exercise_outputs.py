#!/usr/bin/env python3
"""Combine expected exercise outputs into one file.

Usage:
  python scripts/combine_exercise_outputs.py --list-file inputs.txt --output combined.txt

The list file must contain one input path per non-empty, non-comment line.
Lines starting with # after optional leading whitespace are ignored.
Outputs are concatenated in list order with exact file contents preserved.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


def read_list_file(path: Path) -> list[Path]:
    if not path.exists():
        raise SystemExit(f"List file not found: {path}")
    entries: list[Path] = []
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        entries.append(Path(line))
    if not entries:
        raise SystemExit("List file is empty or contains no usable input paths.")
    return entries


def combine(inputs: list[Path], output: Path) -> None:
    resolved_output = output.resolve()
    resolved_inputs = {p.resolve() for p in inputs if p.exists()}
    if resolved_output in resolved_inputs:
        raise SystemExit("Output path must not match any input path.")
    missing = [str(p) for p in inputs if not p.exists()]
    if missing:
        raise SystemExit("Missing input file(s): " + ", ".join(missing))

    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("wb") as out_f:
        for input_path in inputs:
            with input_path.open("rb") as in_f:
                out_f.write(in_f.read())


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--list-file", required=True, help="Text file with one input path per line.")
    parser.add_argument("--output", required=True, help="Combined output file path.")
    args = parser.parse_args()

    inputs = read_list_file(Path(args.list_file))
    combine(inputs, Path(args.output))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
