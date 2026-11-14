import { describe, it, expect } from "vitest";
import { formatReport } from "../src/report.js";

describe("formatReport", () => {
  it("shows success message when no issues or warnings", () => {
    const report = formatReport(
      { issues: [], warnings: [], environment: "development" },
      { color: false },
    );
    expect(report).toContain("All environment variables are valid");
  });

  it("groups errors and warnings separately", () => {
    const report = formatReport(
      {
        issues: [
          {
            key: "PORT",
            code: "INVALID_TYPE",
            message: "Not a number",
            expected: "number",
            received: "abc",
            why: "App needs a port.",
            fix: "Set PORT=3000",
          },
        ],
        warnings: [
          {
            key: "DEBUG",
            code: "DEBUG_IN_PRODUCTION",
            message: "Debug is on in prod",
            fix: "Set DEBUG=false",
          },
        ],
        environment: "production",
      },
      { color: false },
    );
    expect(report).toContain("Errors (1)");
    expect(report).toContain("Warnings (1)");
    expect(report).toContain("PORT");
    expect(report).toContain("DEBUG");
  });

  it("shows summary line", () => {
    const report = formatReport(
      {
        issues: [
          { key: "A", code: "MISSING", message: "missing" },
          { key: "B", code: "MISSING", message: "missing" },
        ],
        warnings: [
          { key: "C", code: "WEAK_SECRET", message: "weak" },
        ],
        environment: "test",
      },
      { color: false },
    );
    expect(report).toContain("2 errors");
    expect(report).toContain("1 warning");
  });

  it("includes why and fix fields when present", () => {
    const report = formatReport(
      {
        issues: [
          {
            key: "DB",
            code: "MISSING",
            message: "Missing",
            why: "Database is required.",
            fix: "Add DB=postgres://...",
          },
        ],
        warnings: [],
        environment: "development",
      },
      { color: false },
    );
    expect(report).toContain("Database is required");
    expect(report).toContain("Add DB=postgres://...");
  });

  it("respects color: false option (no ANSI codes)", () => {
    const report = formatReport(
      {
        issues: [{ key: "X", code: "MISSING", message: "missing" }],
        warnings: [],
        environment: "test",
      },
      { color: false },
    );
    // Should NOT contain ANSI escape sequences.
    expect(report).not.toMatch(/\x1b\[/);
  });
});
