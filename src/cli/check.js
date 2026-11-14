/**
 * @module cli/check
 * Implements the "envpilot check" command.
 */
import { createConfigWithReport } from "../createConfig.js";
import { formatReport } from "../report.js";
import { loadSchema } from "./loadSchema.js";

/**
 * Run the check command.
 *
 * @param {import("./parseArgs.js").CliArgs} args
 * @returns {Promise<number>} exit code
 */
export async function check(args) {
  let schema;
  try {
    schema = await loadSchema({ config: args.config, cwd: args.cwd });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (args.json) {
      process.stdout.write(
        JSON.stringify({ ok: false, error: msg, issues: [], warnings: [] }) + "\n",
      );
    } else {
      process.stderr.write(`Error: ${msg}\n`);
    }
    return 2;
  }

  /** @type {import("../types.js").CreateConfigOptions} */
  const options = {};
  if (args.cwd) {
    options.cwd = args.cwd;
  }
  if (args.env) {
    options.environment = args.env;
  }

  const { issues, warnings, environment } = await createConfigWithReport(schema, options);

  // ── JSON output ────────────────────────────────────────────────────────────
  if (args.json) {
    const out = {
      ok: issues.length === 0 && (!args.strict || warnings.length === 0),
      environment,
      issues: issues.map((i) => ({
        key: i.key,
        code: i.code,
        message: i.message,
        expected: i.expected,
        received: i.received,
        why: i.why,
        fix: i.fix,
      })),
      warnings: warnings.map((w) => ({
        key: w.key,
        code: w.code,
        message: w.message,
        fix: w.fix,
      })),
    };
    process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  } else {
    // ── Human output ──────────────────────────────────────────────────────────
    const report = formatReport(
      { issues, warnings, environment },
      { color: args.noColor ? false : undefined },
    );
    process.stdout.write(report + "\n");
  }

  // ── Exit codes ─────────────────────────────────────────────────────────────
  if (issues.length > 0) {
    return 1;
  }
  if (args.strict && warnings.length > 0) {
    return 1;
  }
  return 0;
}
