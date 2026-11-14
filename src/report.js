/**
 * @module report
 * Formats validation issues and doctor warnings into a human-readable report.
 * Uses raw ANSI codes — no dependencies. Respects NO_COLOR, non-TTY, and
 * an explicit color option.
 */

// ─── ANSI helpers ────────────────────────────────────────────────────────────

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";

/**
 * Determine whether to emit colours.
 *
 * @param {{ color?: boolean }} opts - Explicit option from the caller.
 * @returns {boolean}
 */
function shouldColor(opts) {
  if (opts.color === false) {
    return false;
  }
  if (opts.color === true) {
    return true;
  }
  // Respect the NO_COLOR standard (https://no-color.org).
  if (typeof process !== "undefined" && process.env && "NO_COLOR" in process.env) {
    return false;
  }
  // Non-TTY → no colour.
  if (
    typeof process !== "undefined" &&
    process.stdout &&
    typeof process.stdout.isTTY !== "undefined" &&
    !process.stdout.isTTY
  ) {
    return false;
  }
  return true;
}

/**
 * Build a tiny colorizer — returns a no-op when colour is disabled.
 *
 * @param {boolean} enabled
 * @returns {Record<string, (s: string) => string>}
 */
function makeC(enabled) {
  if (!enabled) {
    return {
      bold: (/** @type {string} */ s) => s,
      red: (/** @type {string} */ s) => s,
      yellow: (/** @type {string} */ s) => s,
      green: (/** @type {string} */ s) => s,
      cyan: (/** @type {string} */ s) => s,
      dim: (/** @type {string} */ s) => s,
    };
  }
  return {
    bold: (/** @type {string} */ s) => `${BOLD}${s}${RESET}`,
    red: (/** @type {string} */ s) => `${RED}${s}${RESET}`,
    yellow: (/** @type {string} */ s) => `${YELLOW}${s}${RESET}`,
    green: (/** @type {string} */ s) => `${GREEN}${s}${RESET}`,
    cyan: (/** @type {string} */ s) => `${CYAN}${s}${RESET}`,
    dim: (/** @type {string} */ s) => `${DIM}${s}${RESET}`,
  };
}

// ─── Formatting ──────────────────────────────────────────────────────────────

/**
 * Format a single issue block.
 *
 * @param {object} issue
 * @param {ReturnType<typeof makeC>} c
 * @returns {string}
 */
function formatIssue(issue, c) {
  const lines = [];
  lines.push(c.bold(c.red(`✖ ${issue.key}`)));
  lines.push(`  ${c.bold("Problem:")} ${issue.message}`);
  if (issue.why) {
    lines.push(`  ${c.bold("Why:")}     ${issue.why}`);
  }
  if (issue.expected) {
    lines.push(`  ${c.bold("Expected:")} ${issue.expected}`);
  }
  if (issue.received !== undefined) {
    lines.push(`  ${c.bold("Received:")} ${issue.received}`);
  }
  if (issue.fix) {
    lines.push(`  ${c.bold("Fix:")}     ${c.cyan(issue.fix)}`);
  }
  return lines.join("\n");
}

/**
 * Format a single warning block.
 *
 * @param {object} warning
 * @param {ReturnType<typeof makeC>} c
 * @returns {string}
 */
function formatWarning(warning, c) {
  const lines = [];
  lines.push(c.bold(c.yellow(`⚠ ${warning.key}`)));
  lines.push(`  ${c.bold("Warning:")} ${warning.message}`);
  if (warning.fix) {
    lines.push(`  ${c.bold("Fix:")}     ${c.cyan(warning.fix)}`);
  }
  return lines.join("\n");
}

/**
 * Format a full validation report.
 *
 * @param {object} data
 * @param {object[]} data.issues       - Validation issues.
 * @param {object[]} data.warnings     - Doctor warnings.
 * @param {string}   data.environment  - Detected environment.
 * @param {{ color?: boolean }} [opts]
 * @returns {string}
 */
export function formatReport({ issues, warnings, environment }, opts = {}) {
  const useColor = shouldColor(opts);
  const c = makeC(useColor);

  const sections = [];

  // Header
  sections.push(c.bold(`EnvPilot Report`) + c.dim(` (${environment})`));
  sections.push("");

  // Errors
  if (issues.length > 0) {
    sections.push(c.bold(c.red(`── Errors (${issues.length}) ──`)));
    sections.push("");
    for (const issue of issues) {
      sections.push(formatIssue(issue, c));
      sections.push("");
    }
  }

  // Warnings
  if (warnings.length > 0) {
    sections.push(c.bold(c.yellow(`── Warnings (${warnings.length}) ──`)));
    sections.push("");
    for (const warning of warnings) {
      sections.push(formatWarning(warning, c));
      sections.push("");
    }
  }

  // Summary line
  const parts = [];
  if (issues.length > 0) {
    parts.push(c.red(`${issues.length} error${issues.length === 1 ? "" : "s"}`));
  }
  if (warnings.length > 0) {
    parts.push(c.yellow(`${warnings.length} warning${warnings.length === 1 ? "" : "s"}`));
  }
  if (parts.length === 0) {
    sections.push(c.green("✔ All environment variables are valid."));
  } else {
    sections.push(parts.join(", "));
  }

  return sections.join("\n");
}
