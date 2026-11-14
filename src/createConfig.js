/**
 * @module createConfig
 * Core validation engine — walks the schema, coerces values, collects issues,
 * and returns a deeply frozen config object.
 */
import { EnvPilotError, ValidationIssue } from "./errors.js";
import { coerce, VALID_TYPES } from "./validate.js";
import { isSecret, maskValue, redact } from "./secrets.js";
import { loadEnvFiles } from "./loadEnvFiles.js";

/** @typedef {import("./types.js").Schema} Schema */
/** @typedef {import("./types.js").CreateConfigOptions} CreateConfigOptions */
/** @typedef {import("./environment.js").Environment} Environment */

// ─── Schema helpers ──────────────────────────────────────────────────────────

/**
 * A node is a *field spec* when it has a string "type" property.
 * Otherwise it is a *group* (nested namespace).
 *
 * Note: a group cannot contain a variable literally named "type".
 *
 * @param {unknown} node
 * @returns {boolean}
 */
function isFieldSpec(node) {
  return (
    node !== null &&
    typeof node === "object" &&
    typeof (/** @type {any} */ (node).type) === "string"
  );
}

/**
 * Recursively flatten a (possibly nested) schema into a list of
 * { envKey, path, spec } entries.
 *
 * @param {Record<string, unknown>} schema
 * @param {string[]} prefix
 * @param {Map<string, string[]>} seen  - Guards against duplicate env-var names.
 * @returns {{ envKey: string, path: string[], spec: object }[]}
 */
function flattenSchema(schema, prefix = [], seen = new Map()) {
  const fields = [];

  for (const [key, node] of Object.entries(schema)) {
    const path = [...prefix, key];
    const envKey = path.join("_");

    if (isFieldSpec(node)) {
      const spec = /** @type {any} */ (node);

      // Guard: validate known schema options.
      if (!VALID_TYPES.has(spec.type)) {
        throw new EnvPilotError([
          new ValidationIssue({
            key: envKey,
            code: "INVALID_SCHEMA",
            message: `Unknown type "${spec.type}" for key "${envKey}". Valid types: ${[...VALID_TYPES].join(", ")}.`,
          }),
        ]);
      }

      if (spec.validate !== undefined && typeof spec.validate !== "function") {
        throw new EnvPilotError([
          new ValidationIssue({
            key: envKey,
            code: "INVALID_SCHEMA",
            message: `"validate" for key "${envKey}" must be a function.`,
          }),
        ]);
      }

      if (seen.has(envKey)) {
        throw new EnvPilotError([
          new ValidationIssue({
            key: envKey,
            code: "INVALID_SCHEMA",
            message: `Duplicate env-var name "${envKey}" produced by two different schema paths.`,
          }),
        ]);
      }
      seen.set(envKey, path);

      fields.push({ envKey, path, spec });
    } else if (node !== null && typeof node === "object") {
      // Recurse into the group.
      fields.push(...flattenSchema(/** @type {any} */ (node), path, seen));
    }
  }

  return fields;
}

// ─── Deep freeze ─────────────────────────────────────────────────────────────

/**
 * Recursively freeze an object and all its nested plain-object values.
 *
 * @template T
 * @param {T} obj
 * @returns {T}
 */
function deepFreeze(obj) {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  Object.freeze(obj);
  for (const val of Object.values(obj)) {
    deepFreeze(val);
  }
  return obj;
}

// ─── Set a value at a nested path ────────────────────────────────────────────

/**
 * @param {Record<string, unknown>} root
 * @param {string[]} path
 * @param {unknown} value
 */
function setAtPath(root, path, value) {
  let cur = root;
  for (let i = 0; i < path.length - 1; i++) {
    const seg = path[i];
    if (cur[seg] === undefined) {
      cur[seg] = {};
    }
    cur = /** @type {any} */ (cur[seg]);
  }
  cur[path[path.length - 1]] = value;
}

// ─── Main validation loop ─────────────────────────────────────────────────────

/**
 * @typedef {Object} FieldResult
 * @property {ValidationIssue[]} issues
 * @property {unknown}           value    - undefined when the field has no value.
 * @property {string}            envKey
 * @property {string[]}          path
 */

/**
 * Validate a single field.
 *
 * @param {object} opts
 * @param {string}   opts.envKey
 * @param {string[]} opts.path
 * @param {any}      opts.spec
 * @param {Record<string, string|undefined>} opts.env
 * @param {Environment} opts.environment
 * @returns {FieldResult}
 */
function validateField({ envKey, path, spec, env, environment }) {
  const issues = [];
  const secret = isSecret(envKey, spec);
  const received = (val) => (secret ? maskValue() : String(val));

  // ── 1. Resolve raw value ──────────────────────────────────────────────────
  let raw = env[envKey];
  const isMissing = raw === undefined || raw === "";

  if (isMissing) {
    if (spec.default !== undefined) {
      // Use the default — but still type-check it.
      raw = String(spec.default);
    } else if (spec.required) {
      const description = spec.description ? ` (${spec.description})` : "";
      issues.push(
        new ValidationIssue({
          key: envKey,
          code: "MISSING",
          message: `Required variable "${envKey}"${description} is missing or empty.`,
          expected: spec.type,
          why: `The application cannot start without "${envKey}". This variable must be set in your environment.`,
          fix: `Add ${envKey}=<your-${spec.type}-value> to your .env file.`,
        }),
      );
      return { issues, value: undefined, envKey, path };
    } else {
      return { issues, value: undefined, envKey, path };
    }
  }

  // ── 2. Type coercion ──────────────────────────────────────────────────────
  let coerced;
  try {
    coerced = coerce(raw, spec.type);
  } catch (err) {
    // Redact the coercer's error message if the field is secret — the raw
    // value may appear literally inside strings like `"xyz" is not a valid number`.
    const secretVals = secret ? [raw] : [];
    const safeMsg = redact(err.message, secretVals);
    issues.push(
      new ValidationIssue({
        key: envKey,
        code: "INVALID_TYPE",
        message: `Invalid value for "${envKey}": ${safeMsg}`,
        expected: spec.type,
        received: received(raw),
        why: `The application expects "${envKey}" to be a valid ${spec.type}.`,
        fix: exampleFix(envKey, spec.type),
      }),
    );
    return { issues, value: undefined, envKey, path };
  }

  // ── 3. Custom validator ───────────────────────────────────────────────────
  if (typeof spec.validate === "function") {
    const ctx = { key: envKey, env, environment };
    let result;
    try {
      result = spec.validate(coerced, ctx);
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      // Scrub any secret values from the error message.
      const secretVals = secret ? [raw] : [];
      const safeMsg = redact(rawMsg, secretVals);
      issues.push(
        new ValidationIssue({
          key: envKey,
          code: "CUSTOM_VALIDATION",
          message: `Custom validation failed for "${envKey}": ${safeMsg}`,
          received: received(raw),
          why: `A custom rule rejected the value provided for "${envKey}".`,
          fix: `Check the validation rules defined in your schema for "${envKey}".`,
        }),
      );
      return { issues, value: undefined, envKey, path };
    }

    if (result !== true && result !== undefined) {
      const rawMsg =
        typeof result === "string" ? result : `Value for "${envKey}" is invalid.`;
      const secretVals = secret ? [raw] : [];
      const safeMsg = redact(rawMsg, secretVals);
      issues.push(
        new ValidationIssue({
          key: envKey,
          code: "CUSTOM_VALIDATION",
          message: safeMsg,
          received: received(raw),
          why: `A custom rule rejected the value provided for "${envKey}".`,
          fix: `Check the validation rules defined in your schema for "${envKey}".`,
        }),
      );
      return { issues, value: undefined, envKey, path };
    }
  }

  return { issues, value: coerced, envKey, path };
}

/**
 * Build a human-friendly fix example for a given type.
 *
 * @param {string} key
 * @param {string} type
 * @returns {string}
 */
function exampleFix(key, type) {
  const examples = {
    number: `${key}=3000`,
    boolean: `${key}=true`,
    url: `${key}=https://example.com`,
    string: `${key}=your-value-here`,
  };
  return `Add ${examples[type] ?? `${key}=<value>`} to your .env file.`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Validate environment variables against a schema and return a frozen config object.
 * Throws a single EnvPilotError listing ALL issues found.
 *
 * @param {Schema} schema
 * @param {CreateConfigOptions} [options]
 * @returns {Record<string, unknown>}
 */
export function createConfig(schema, options = {}) {
  const { merged, environment } = loadEnvFiles(options);

  const fields = flattenSchema(schema);
  const issues = [];
  const result = {};

  for (const { envKey, path, spec } of fields) {
    const fr = validateField({ envKey, path, spec, env: merged, environment });
    issues.push(...fr.issues);
    if (fr.issues.length === 0 && fr.value !== undefined) {
      setAtPath(result, path, fr.value);
    }
  }

  if (issues.length > 0) {
    throw new EnvPilotError(issues);
  }

  return deepFreeze(result);
}

/**
 * Like createConfig but never throws.
 * Returns { config, warnings, issues, environment }.
 *
 * Warnings come from the doctor module (loaded lazily to avoid circular deps).
 *
 * @param {Schema} schema
 * @param {CreateConfigOptions} [options]
 * @returns {{ config: Record<string, unknown> | null, issues: ValidationIssue[], warnings: object[], environment: Environment }}
 */
export async function createConfigWithReport(schema, options = {}) {
  let merged, environment;
  try {
    ({ merged, environment } = loadEnvFiles(options));
  } catch (err) {
    const issues =
      err instanceof EnvPilotError
        ? err.issues
        : [
            new ValidationIssue({
              key: "SETUP",
              code: "INVALID_SCHEMA",
              message: String(err),
            }),
          ];
    return { config: null, issues, warnings: [], environment: "development" };
  }

  const fields = flattenSchema(schema);
  const issues = [];
  const result = {};

  for (const { envKey, path, spec } of fields) {
    const fr = validateField({ envKey, path, spec, env: merged, environment });
    issues.push(...fr.issues);
    if (fr.issues.length === 0 && fr.value !== undefined) {
      setAtPath(result, path, fr.value);
    }
  }

  let config = null;
  let warnings = [];

  if (issues.length === 0) {
    config = deepFreeze(result);
    // Lazily import doctor to avoid circular deps.
    try {
      const { doctor } = await import("./doctor.js");
      warnings = doctor({ config, schema, fields, env: merged, environment });
    } catch {
      // doctor not yet available — no warnings.
    }
  }

  return { config, issues, warnings, environment };
}
