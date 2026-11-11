import { describe, it, expect } from "vitest";
import { ValidationIssue, EnvPilotError } from "../src/errors.js";

describe("ValidationIssue", () => {
  it("stores all fields", () => {
    const issue = new ValidationIssue({
      key: "PORT",
      code: "INVALID_TYPE",
      message: "Expected a number",
      expected: "number",
      received: "abc",
    });

    expect(issue.key).toBe("PORT");
    expect(issue.code).toBe("INVALID_TYPE");
    expect(issue.message).toBe("Expected a number");
    expect(issue.expected).toBe("number");
    expect(issue.received).toBe("abc");
  });

  it("allows omitting optional fields", () => {
    const issue = new ValidationIssue({
      key: "SECRET",
      code: "MISSING",
      message: "Required variable is missing",
    });

    expect(issue.expected).toBeUndefined();
    expect(issue.received).toBeUndefined();
  });

  it("toString includes code, key and message", () => {
    const issue = new ValidationIssue({
      key: "PORT",
      code: "INVALID_TYPE",
      message: "Expected a number",
      expected: "number",
      received: "abc",
    });

    const str = issue.toString();
    expect(str).toContain("[INVALID_TYPE]");
    expect(str).toContain("PORT");
    expect(str).toContain("Expected a number");
    expect(str).toContain("number");
    expect(str).toContain("abc");
  });

  it("toString omits expected/received when not provided", () => {
    const issue = new ValidationIssue({
      key: "DB",
      code: "MISSING",
      message: "Required",
    });
    const str = issue.toString();
    expect(str).not.toContain("expected");
    expect(str).not.toContain("received");
  });
});

describe("EnvPilotError", () => {
  it("is an instance of Error", () => {
    const err = new EnvPilotError([
      new ValidationIssue({ key: "X", code: "MISSING", message: "Missing" }),
    ]);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(EnvPilotError);
  });

  it("has name EnvPilotError", () => {
    const err = new EnvPilotError([
      new ValidationIssue({ key: "X", code: "MISSING", message: "Missing" }),
    ]);
    expect(err.name).toBe("EnvPilotError");
  });

  it("exposes all issues", () => {
    const issues = [
      new ValidationIssue({ key: "A", code: "MISSING", message: "Missing A" }),
      new ValidationIssue({ key: "B", code: "INVALID_TYPE", message: "Bad B", expected: "number", received: "foo" }),
    ];
    const err = new EnvPilotError(issues);
    expect(err.issues).toHaveLength(2);
    expect(err.issues[0].key).toBe("A");
    expect(err.issues[1].key).toBe("B");
  });

  it("message contains issue count and details", () => {
    const issues = [
      new ValidationIssue({ key: "A", code: "MISSING", message: "Missing A" }),
      new ValidationIssue({ key: "B", code: "MISSING", message: "Missing B" }),
    ];
    const err = new EnvPilotError(issues);
    expect(err.message).toContain("2 issue(s)");
    expect(err.message).toContain("Missing A");
    expect(err.message).toContain("Missing B");
  });
});

