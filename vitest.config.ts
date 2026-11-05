import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts", "src/types/**"],
      // json-summary feeds scripts/coverage-summary.mjs (CI step summary, PR
      // comment, metrics/coverage.csv); lcov is the interchange format for
      // coverage UIs (Codecov, SonarQube, VS Code coverage gutters).
      reporter: ["text", "html", "json-summary", "lcov"],
      thresholds: {
        lines: 80,
        branches: 45,
        functions: 80,
      },
    },
  },
});
