#!/usr/bin/env bash
set -euo pipefail

run_stage() {
  local label="$1"
  shift

  echo "=== ${label} ==="
  if "$@"; then
    echo "PASS: ${label}"
  else
    echo "FAIL: ${label}"
    exit 1
  fi
}

type_check() {
  npm run db:generate && npm run typecheck
}

lint() {
  npm run lint
}

format_check() {
  npm run format:check
}

tests_with_coverage() {
  npm run test:coverage
}

dependency_audit() {
  npm run audit:gate && npm audit signatures
}

run_stage "Type check" type_check
run_stage "Lint" lint
run_stage "Format check" format_check
run_stage "Tests with coverage" tests_with_coverage
run_stage "Dependency audit" dependency_audit