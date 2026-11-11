/**
 * @typedef {"MISSING" | "INVALID_TYPE" | "INVALID_SCHEMA"} IssueCode
 */

/**
 * Represents a single validation problem for one config key.
 */
export class ValidationIssue {
  /**
   * @param {Object} opts
   * @param {string}    opts.key       - The schema key that failed.
   * @param {IssueCode} opts.code      - Machine-readable error code.
   * @param {string}    opts.message   - Human-readable explanation.
   * @param {string}    [opts.expected] - What was expected (e.g. "number").
   * @param {string}    [opts.received] - What was actually received (omitted for secrets).
   */
  constructor({ key, code, message, expected, received }) {
    /** @type {string} */
    this.key = key;
    /** @type {IssueCode} */
    this.code = code;
    /** @type {string} */
    this.message = message;
    /** @type {string | undefined} */
    this.expected = expected;
    /** @type {string | undefined} */
    this.received = received;
  }

  /**
   * Compact string representation for use in error messages.
   * @returns {string}
   */
  toString() {
    const parts = [`[${this.code}] ${this.key}: ${this.message}`];
    if (this.expected !== undefined) {
      parts.push(`  expected : ${this.expected}`);
    }
    if (this.received !== undefined) {
      parts.push(`  received : ${this.received}`);
    }
    return parts.join("\n");
  }
}

/**
 * Thrown by createConfig when one or more validation issues are found.
 * Always collects ALL issues before throwing — never stops at the first.
 */
export class EnvPilotError extends Error {
  /**
   * @param {ValidationIssue[]} issues - Every issue found during validation.
   */
  constructor(issues) {
    const summary = issues.map((i) => i.toString()).join("\n\n");
    super(`EnvPilot found ${issues.length} issue(s):\n\n${summary}`);

    /** @type {string} */
    this.name = "EnvPilotError";

    /** @type {ValidationIssue[]} */
    this.issues = issues;

    // Maintain a proper prototype chain in transpiled environments.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

