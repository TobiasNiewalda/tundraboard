import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const work = join(root, "tests", "fixtures", "utility-scripts");

function py(script: string, args: string[]) {
  return execFileSync("python", [join(root, "scripts", script), ...args], {
    encoding: "utf8",
  });
}

describe("combine_exercise_outputs", () => {
  it("combines files in order and preserves exact contents", () => {
    rmSync(work, { recursive: true, force: true });
    mkdirSync(work, { recursive: true });
    const a = join(work, "a.txt");
    const b = join(work, "b.txt");
    const list = join(work, "inputs.txt");
    const out = join(work, "combined.txt");
    writeFileSync(a, "first\n", "utf8");
    writeFileSync(b, "second", "utf8");
    writeFileSync(list, `# comment\n${a}\n\n${b}\n`, "utf8");

    py("combine_exercise_outputs.py", ["--list-file", list, "--output", out]);

    expect(readFileSync(out, "utf8")).toBe("first\nsecond");
  });

  it("fails for missing inputs and empty lists", () => {
    const list = join(work, "empty.txt");
    writeFileSync(list, "\n# nothing\n", "utf8");
    expect(() =>
      py("combine_exercise_outputs.py", [
        "--list-file",
        list,
        "--output",
        join(work, "x.txt"),
      ]),
    ).toThrow();
  });
});

describe("skillio_html_extract", () => {
  it("fails when the source selector is missing", () => {
    const html = join(work, "missing-source.html");
    writeFileSync(
      html,
      `<div id="lesson"><p>Only content</p><div id="exercise"></div></div>`,
      "utf8",
    );
    expect(() =>
      py("skillio_html_extract.py", [
        "--html",
        html,
        "--boundary-selector",
        "#exercise",
        "--content-output",
        join(work, "c.md"),
        "--exercise-output",
        join(work, "e.md"),
      ]),
    ).toThrow();
  });

  it("requires selectors and converts semantic html", () => {
    rmSync(work, { recursive: true, force: true });
    mkdirSync(work, { recursive: true });
    const html = join(work, "lesson.html");
    const content = join(work, "Content.md");
    const exercise = join(work, "Exercise.md");
    writeFileSync(
      html,
      `<div id="lesson"><h2>Intro</h2><p>See <a href="/docs">docs</a>.</p><div id="exercise"><h3>Task</h3><ul><li>Do it</li></ul></div></div>`,
      "utf8",
    );

    py("skillio_html_extract.py", [
      "--html",
      html,
      "--source-selector",
      "#lesson",
      "--boundary-selector",
      "#exercise",
      "--content-output",
      content,
      "--exercise-output",
      exercise,
    ]);
    expect(readFileSync(content, "utf8")).toContain("# Intro");
    expect(readFileSync(exercise, "utf8")).toContain("### Task");
  });

  it("fails when boundary is missing or ambiguous", () => {
    const html = join(work, "lesson2.html");
    writeFileSync(html, `<div id="lesson"><p>Only content</p></div>`, "utf8");
    expect(() =>
      py("skillio_html_extract.py", [
        "--html",
        html,
        "--source-selector",
        "#lesson",
        "--boundary-selector",
        "#exercise",
        "--content-output",
        join(work, "c.md"),
        "--exercise-output",
        join(work, "e.md"),
      ]),
    ).toThrow();
  });
});
