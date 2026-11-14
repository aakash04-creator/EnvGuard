/**
 * @module doctor
 * The "Smart Configuration Doctor" — generates warnings that do NOT fail
 * validation but flag potential production issues.
 *
 * Warning codes:
 *   WEAK_SECRET            — secret value shorter than 16 characters.
 *   DEBUG_IN_PRODUCTION    — a DEBUG-like boolean is true in production.
 *   LOCALHOST_IN_PRODUCTION — URL host is localhost or 127.0.0.1 in production.
 *   DEFAULT_IN_PRODUCTION  — variable fell back to its default in production.
 */

import { isSecret, maskValue } from "./secrets.js";

/**
 * @typedef {Object} Warning
 * @property {string} key     - The env-var key.
 * @property {string} code    - Machine-readable warning code.
 * @property {string} message - Human-readable description.
 * @property {string} fix     - How to fix it.
 */

/**
 * Run all doctor checks and return an array of warnings.
 *
 * @param {object}  opts
 * @param {Record<string, unknown>}  opts.config      - The resolved, coerced config.
 * @param {Record<string, unknown>}  opts.schema      - The original schema.
 * @param {{ envKey: string, path: string[], spec: any }[]} opts.fields - Flattened fields.
 * @param {Record<string, string|undefined>} opts.env  - Merged environment.
 * @param {string}  opts.environment                   - Detected environment.
 * @returns {Warning[]}
 */
export function doctor({ config, schema, fields, env, environment }) {
  /** @type {Warning[]} */
  const warnings = [];

  for (const { envKey, spec } of fields) {
    const raw = env[envKey];
    const secret = isSecret(envKey, spec);

    // ── WEAK_SECRET ─────────────────────────────────────────────────────────
    if (secret && raw && raw.length < 16) {
      warnings.push({
        key: envKey,
        code: "WEAK_SECRET",
        message: `Secret "${envKey}" is only ${raw.length} characters long (minimum recommended: 16).`,
        fix: `Generate a stronger value for ${envKey} (at least 16 characters).`,
      });
    }

    // ── DEBUG_IN_PRODUCTION ─────────────────────────────────────────────────
    if (
      environment === "production" &&
      spec.type === "boolean" &&
      /debug/i.test(envKey)
    ) {
      const rawLower = (raw ?? "").trim().toLowerCase();
      if (["true", "1", "yes"].includes(rawLower)) {
        warnings.push({
          key: envKey,
          code: "DEBUG_IN_PRODUCTION",
          message: `"${envKey}" is enabled in production. Debug mode may expose sensitive information.`,
          fix: `Set ${envKey}=false in your production environment.`,
        });
      }
    }

    // ── LOCALHOST_IN_PRODUCTION ──────────────────────────────────────────────
    if (environment === "production" && spec.type === "url" && raw) {
      try {
        const parsed = new URL(raw.trim());
        if (
          parsed.hostname === "localhost" ||
          parsed.hostname === "127.0.0.1"
        ) {
          warnings.push({
            key: envKey,
            code: "LOCALHOST_IN_PRODUCTION",
            message: `"${envKey}" points to localhost in production.`,
            fix: `Set ${envKey} to a remote host URL for production.`,
          });
        }
      } catch {
        // URL parsing failure already caught by type validation; skip.
      }
    }

    // ── DEFAULT_IN_PRODUCTION ───────────────────────────────────────────────
    if (environment === "production" && spec.default !== undefined) {
      const originalRaw = env[envKey];
      const isMissing = originalRaw === undefined || originalRaw === "";
      if (isMissing) {
        warnings.push({
          key: envKey,
          code: "DEFAULT_IN_PRODUCTION",
          message: `"${envKey}" is using its default value in production.`,
          fix: `Explicitly set ${envKey} in your production environment instead of relying on the default.`,
        });
      }
    }
  }

  return warnings;
}
