/**
 * @module secrets
 * Utilities for detecting and masking secret configuration values.
 */

/**
 * Suffixes (and substrings) that mark an env-var name as a secret.
 * All comparisons are case-insensitive.
 */
const SECRET_SUFFIXES = ["_SECRET", "_KEY", "_TOKEN", "_PASSWORD", "_PASSWD"];
const SECRET_SUBSTRINGS = ["PRIVATE_KEY"];

/**
 * Return the masked placeholder used in place of any secret value.
 * We never reveal length or any characters.
 *
 * @returns {string}
 */
export function maskValue() {
  return "[hidden]";
}

/**
 * Decide whether an env-var name is inherently secret by naming convention.
 *
 * @param {string} name - The env-var key (e.g. "JWT_SECRET").
 * @returns {boolean}
 */
export function isSecretKey(name) {
  const upper = name.toUpperCase();
  if (SECRET_SUBSTRINGS.some((s) => upper.includes(s))) {
    return true;
  }
  return SECRET_SUFFIXES.some((suffix) => upper.endsWith(suffix));
}

/**
 * Decide whether a field should be treated as secret given its schema spec
 * and variable name.
 *
 * Rules (in priority order):
 *  1. spec.secret === false → never secret (explicit opt-out).
 *  2. spec.secret === true  → always secret (explicit opt-in).
 *  3. isSecretKey(name)     → secret by naming convention.
 *
 * @param {string} name - The env-var key.
 * @param {{ secret?: boolean }} spec - The field schema entry.
 * @returns {boolean}
 */
export function isSecret(name, spec) {
  if (spec.secret === false) {
    return false;
  }
  if (spec.secret === true) {
    return true;
  }
  return isSecretKey(name);
}

/**
 * Replace every occurrence of a known secret value inside `text` with
 * "[hidden]".  Values shorter than 3 characters are skipped to avoid
 * accidentally mangling common words.
 *
 * @param {string} text          - The string to sanitise.
 * @param {string[]} secretValues - Known secret values to scrub.
 * @returns {string}
 */
export function redact(text, secretValues) {
  let result = text;
  for (const val of secretValues) {
    if (typeof val !== "string" || val.length < 3) {
      continue;
    }
    // Escape special regex characters in the secret value.
    const escaped = val.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(escaped, "g"), maskValue());
  }
  return result;
}
