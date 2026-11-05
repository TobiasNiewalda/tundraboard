---
name: multi-agent-handoffs
description: Define and enforce handoff contracts between a supervisor agent and sub-agents. Use when designing, prompting or reviewing a multi-agent run (supervisor-worker, sequential stages, Cline spawn_agent), or when writing the handoff section of an exercise or report.
---

# Multi-agent handoffs

A handoff is the only thing that crosses from one agent's context into another's. Define it as a typed contract, check it, and make it easy to find in the transcript. The rules below come from a run where the handoffs were loose JSON and every one of these went wrong.

## 1. Typed fields, validated by the supervisor

- No prose fields such as `contract` or `result`. Name the fields: `stage`, `status` (`done` | `blocked` | `failed`), `filesChanged`, `commitSha`, plus stage-specific facts such as `migrationName`, `columnName`, `indexName`, `route`, `serviceFn`.
- Cap free text: `summary` has a maximum length (for example 500 characters) and the cap is written in the handoff.
- The supervisor rejects a return with a missing or mistyped field, or an over-long summary, and asks once for a corrected return.

## 2. Put every fact in the handoff, and forbid re-exploring

- Pass what the worker needs: table name, column maps, file paths, upstream identifiers.
- Add the rule: "Do not search the codebase. If a fact is missing, return `status: blocked` and name it."
- Pick one model of work: either the supervisor reads files and passes the facts, or it reads nothing and passes only pointers. Never both, or each file is read twice.

## 3. "Done when" must be checkable without trusting the worker

- Write checks the supervisor runs itself, for example: `git show --stat <sha>` lists only the `allowedPaths`; the migration status command is clean; the test command exits 0.
- A worker's summary is a claim. Compare it with the diff.

## 4. One environment block at the top of every handoff

- OS and shell, for example Windows + PowerShell: no `grep`, no `rmdir /s`, run npx as `cmd /c npx`.
- Database state: list the migrations that already exist, and reset the database before the run. Leftover state from an earlier run causes drift errors.

## 5. Forbidden actions, and a way to refuse

- Forbid `--no-verify`, `git reset --hard`, and editing hooks or guardrails.
- State that when a rule blocks the worker, the correct output is `status: blocked` with `blockedReason`, never a workaround.

## 6. Budget, and a partial report

- Give each worker `maxIterations` (for example 15) and tell it to stop at the cap.
- At the cap, or on any error, it returns what is done and what is left, not a bare error.
- The supervisor checks the remaining budget before it spawns a worker. Lifetime caps are easy to hit.

## 7. Do not trust the self-reported model

- A model cannot reliably name itself. Set the sub-agent model in the tool's settings.
- Verify it from the `usage` data in the spawn result or the provider's activity log. Drop `model` from the return, or label it untrusted.

## 8. Split stages along real interfaces

- If two concerns end up in one change (for example query parsing and ranking in one SQL statement), they are not separable. Merge them into one worker, or define the interface between them, for example `searchTasks(query): Promise<Task[]>` with ranking inside.
- Fewer, larger stages mean fewer handoffs to pay for.

## 9. Test the protocol cheaply first

- Run a trivial task with `maxIterations: 2`. Check three things: sub-agents actually spawn, the model is right, and the return block validates.
- Fix the protocol there, not on the expensive run.

## 10. Make handoffs easy to find in the transcript

- Use fixed markers: `=== HANDOFF-OUT #n -> <worker> ===` and `=== HANDOFF-RETURN #n <- <worker> ===`.
- The supervisor writes the same text in its reasoning and in the sub-agent prompt, so a reader can check that each handoff happened.
- Do not use loose JSON. It forces the contracts to be reconstructed afterwards.

## Template

```ts
interface Environment {
  os: string;                  // "windows"
  shell: string;               // "powershell"
  baseBranch: string;
  workBranch: string;
  existingMigrations: string[];
}

interface CommonHandoff {
  taskId: number;
  env: Environment;
  allowedPaths: string[];
  forbidden: string[];         // ["--no-verify", "git reset --hard", "edit hooks"]
  maxIterations: number;
  summaryMaxChars: number;
  doneWhen: string[];          // commands the supervisor runs, with the expected result
}

interface CommonReturn {
  taskId: number;
  status: "done" | "blocked" | "failed";
  blockedReason?: string;      // required when status is "blocked"
  commitSha: string | null;
  filesInCommit: string[];     // must equal `git show --stat <sha>`
  summary: string;             // at most summaryMaxChars
  remaining?: string[];        // what is left, when status is not "done"
}
```

Extend `CommonHandoff` and `CommonReturn` per stage. A stage return carries the identifiers the next stage needs. The next handoff takes only those typed fields as `upstream`, never a transcript, tool output or reasoning text.

## Checklist before a run

- [ ] Stages split along real interfaces
- [ ] Every handoff has typed fields, a summary cap and `doneWhen` commands
- [ ] Environment block and existing migrations listed
- [ ] Forbidden actions and the `blocked` exit written down
- [ ] `maxIterations` set, budget checked
- [ ] Sub-agent model set in settings and verifiable from usage data
- [ ] HANDOFF-OUT and HANDOFF-RETURN markers specified
- [ ] Dry run with `maxIterations: 2` passed
