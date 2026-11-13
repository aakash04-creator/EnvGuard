/**
 * @module environment
 * Detect the current runtime environment from NODE_ENV.
 */
import { EnvPilotError, ValidationIssue } from "./errors.js";

/** @typedef {"development" | "test" | "production"} Environment */

const ALIASES = {
  dev: "development",
  prod: "production",
};

const VALID = new Set(["development", "test", "production"]);

/**
 * Detect the current environment from NODE_ENV in the given env map.
 * - Accepts aliases: "dev" → "development", "prod" → "production".
 * - Defaults to "development" when NODE_ENV is unset or empty.
 * - Throws an EnvPilotError for unrecognised values.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {Environment}
 */
export function detectEnvironment(env = process.env) {
  const raw = (env["NODE_ENV"] ?? "").trim().toLowerCase();

  if (!raw) {
    return "development";
  }

  const resolved = ALIASES[raw] ?? raw;

  if (!VALID.has(resolved)) {
    throw new EnvPilotError([
      new ValidationIssue({
        key: "NODE_ENV",
        code: "INVALID_TYPE",
        message: `Unrecognised NODE_ENV value "${env["NODE_ENV"]}". Allowed values: development, test, production (aliases: dev, prod).`,
        expected: "development | test | production",
        received: env["NODE_ENV"],
      }),
    ]);
  }

  return /** @type {Environment} */ (resolved);
}
