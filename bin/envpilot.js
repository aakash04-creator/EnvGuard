#!/usr/bin/env node

/**
 * envpilot CLI — validate environment variables from your terminal.
 *
 * Usage:
 *   envpilot check [options]
 *
 * Options:
 *   --env <name>      Override environment (development|test|production)
 *   --cwd <dir>       Working directory (default: .)
 *   --config <path>   Path to config file (default: envpilot.config.js)
 *   --json            Output JSON
 *   --no-color        Disable colours
 *   --strict          Treat warnings as failures
 *   --help, -h        Show this help
 *   --version, -v     Show version
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "../src/cli/parseArgs.js";
import { redact } from "../src/secrets.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const HELP = `
envpilot — Smart Configuration Doctor

Usage:
  envpilot check [options]

Commands:
  check     Validate environment variables against your schema

Options:
  --env <name>      Override environment (development|test|production)
  --cwd <dir>       Working directory (default: .)
  --config <path>   Path to config file (default: envpilot.config.js)
  --json            Output JSON (secrets masked)
  --no-color        Disable colours
  --strict          Treat warnings as failures (exit 1)
  --help, -h        Show this help
  --version, -v     Show version
`.trim();

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // --version
  if (args.version) {
    try {
      const pkg = JSON.parse(
        readFileSync(resolve(__dirname, "..", "package.json"), "utf8"),
      );
      process.stdout.write(`envpilot v${pkg.version}\n`);
    } catch {
      process.stdout.write("envpilot (unknown version)\n");
    }
    process.exit(0);
  }

  // --help or no command
  if (args.help || !args.command) {
    process.stdout.write(HELP + "\n");
    process.exit(0);
  }

  if (args.command === "check") {
    const { check } = await import("../src/cli/check.js");
    const code = await check(args);
    process.exit(code);
  }

  process.stderr.write(
    `Unknown command: ${args.command}\nRun envpilot --help for usage.\n`,
  );
  process.exit(2);
}

main().catch((err) => {
  // Never print secret values, even in stack traces.
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Fatal: ${msg}\n`);
  process.exit(2);
});
