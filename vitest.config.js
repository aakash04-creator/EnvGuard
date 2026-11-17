import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**"],
      // CLI is tested end-to-end via child_process (not visible to v8);
      // index.js only re-exports.
      exclude: ["src/cli/**", "src/index.js"],
      thresholds: { lines: 85, statements: 85, branches: 80, functions: 80 },
    },
  },
});