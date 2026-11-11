import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Run test files inside tests/
    include: ["tests/**/*.test.js"],
    // Print a clear diff on assertion failures
    reporters: ["verbose"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**"],
    },
  },
});

