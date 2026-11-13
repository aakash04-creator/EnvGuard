/**
 * @module validate
 * Type coercers and low-level field validators for EnvPilot.
 *
 * Each coercer receives the raw string value and returns the coerced value,
 * or throws a TypeError with a descriptive message on failure.
 */

/** @typedef {import("./types.js").FieldType} FieldType */

const BOOLEAN_TRUE = new Set(["true", "1", "yes"]);
const BOOLEAN_FALSE = new Set(["false", "0", "no"]);

/**
 * Coerce a raw string to a JavaScript number.
 * Rejects empty strings and NaN results.
 *
 * @param {string} raw
 * @returns {number}
 */
export function coerceNumber(raw) {
  const trimmed = raw.trim();
  if (trimmed === "") {
    throw new TypeError("Cannot convert an empty string to a number");
  }
  const n = Number(trimmed);
  if (Number.isNaN(n)) {
    throw new TypeError(`"${raw}" is not a valid number`);
  }
  return n;
}

/**
 * Coerce a raw string to a JavaScript boolean.
 * Accepts true/false/1/0/yes/no (case-insensitive).
 *
 * @param {string} raw
 * @returns {boolean}
 */
export function coerceBoolean(raw) {
  const lower = raw.trim().toLowerCase();
  if (BOOLEAN_TRUE.has(lower)) {
    return true;
  }
  if (BOOLEAN_FALSE.has(lower)) {
    return false;
  }
  throw new TypeError(
    `"${raw}" is not a valid boolean — accepted values: true, false, 1, 0, yes, no`,
  );
}

/**
 * Validate that a raw string is a well-formed URL using the WHATWG URL constructor.
 * Returns the original string (not a URL object) so it stays serialisable.
 *
 * @param {string} raw
 * @returns {string}
 */
export function coerceUrl(raw) {
  const trimmed = raw.trim();
  try {
    new URL(trimmed);
  } catch {
    throw new TypeError(`"${raw}" is not a valid URL`);
  }
  return trimmed;
}

/**
 * Coerce a raw string value according to the given field type.
 * "string" is a no-op (returns the value as-is).
 *
 * @param {string} raw   - Raw string from the environment.
 * @param {FieldType} type
 * @returns {unknown}    - Coerced value.
 */
export function coerce(raw, type) {
  switch (type) {
    case "string":
      return raw;
    case "number":
      return coerceNumber(raw);
    case "boolean":
      return coerceBoolean(raw);
    case "url":
      return coerceUrl(raw);
    default:
      throw new TypeError(`Unknown field type: "${type}"`);
  }
}

/**
 * The set of recognised field types.
 * @type {Set<FieldType>}
 */
export const VALID_TYPES = new Set(["string", "number", "boolean", "url"]);

