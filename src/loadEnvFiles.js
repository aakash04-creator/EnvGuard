/**
 * @module loadEnvFiles
 * Load environment-specific .env files and merge them with the real env.
 *
 * File precedence (lowest → highest):
 *   .env  <  .env.<environment>  <  .env.local  <  .env.<environment>.local
 *
 * Real environment variables (options.env) always win over file values.
 * Files never mutate process.env.
 */
import { join } from "node:path";
import { loadEnvFile } from "./loadEnvFile.js";
import { detectEnvironment } from "./environment.js";

/**
 * @typedef {import("./environment.js").Environment} Environment
 */

/**
 * Determine the active environment using this priority:
 *   1. options.environment (explicit override)
 *   2. NODE_ENV from real env (options.env)
 *   3. NODE_ENV from the base .env file
 *   4. "development"
 *
 * @param {{ environment?: string, env?: Record<string, string|undefined>, cwd?: string }} opts
 * @returns {Environment}
 */
export function resolveEnvironment(opts = {}) {
  if (opts.environment) {
    return detectEnvironment({ NODE_ENV: opts.environment });
  }
  const realEnv = opts.env ?? process.env;
  if (realEnv["NODE_ENV"]) {
    return detectEnvironment(realEnv);
  }
  // Fall back to NODE_ENV inside the base .env file.
  const cwd = opts.cwd ?? process.cwd();
  const baseFile = loadEnvFile(join(cwd, ".env"));
  if (baseFile["NODE_ENV"]) {
    return detectEnvironment(baseFile);
  }
  return "development";
}

/**
 * Load all .env files for the given environment and merge them with the
 * real environment (realEnv always wins).
 *
 * @param {object} [opts]
 * @param {boolean}   [opts.envFile=true]   - Set false to skip file loading entirely.
 * @param {string}    [opts.cwd]            - Directory to look for .env files (default: process.cwd()).
 * @param {string}    [opts.environment]    - Explicit environment override.
 * @param {Record<string, string|undefined>} [opts.env] - Real env (default: process.env).
 * @returns {{ merged: Record<string, string|undefined>, environment: Environment }}
 */
export function loadEnvFiles(opts = {}) {
  const realEnv = opts.env ?? process.env;
  const cwd = opts.cwd ?? process.cwd();

  if (opts.envFile === false) {
    const environment = resolveEnvironment({ environment: opts.environment, env: realEnv, cwd });
    return { merged: { ...realEnv }, environment };
  }

  const environment = resolveEnvironment({ environment: opts.environment, env: realEnv, cwd });

  // Load files lowest → highest precedence.
  const files = [
    join(cwd, ".env"),
    join(cwd, `.env.${environment}`),
    join(cwd, ".env.local"),
    join(cwd, `.env.${environment}.local`),
  ];

  let merged = {};
  for (const file of files) {
    merged = { ...merged, ...loadEnvFile(file) };
  }

  // Real env always overrides file values.
  merged = { ...merged, ...realEnv };

  return { merged, environment };
}
