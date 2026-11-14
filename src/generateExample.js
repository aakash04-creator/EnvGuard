/**
 * @module generateExample
 * Generates .env.example content from an EnvPilot schema.
 */

import { isSecret } from "./secrets.js";

/**
 * Check if a schema node is a variable specification.
 *
 * @param {unknown} node
 * @returns {boolean}
 */
function isFieldSpec(node) {
  return (
    node !== null &&
    typeof node === "object" &&
    !Array.isArray(node) &&
    typeof /** @type {any} */ (node).type === "string"
  );
}

/**
 * Collect variables grouped by namespace path.
 *
 * @param {Record<string, unknown>} schema
 * @param {string[]} [prefix=[]]
 * @param {Map<string, Array<{ envKey: string, spec: any }>>} [groups=new Map()]
 * @returns {Map<string, Array<{ envKey: string, spec: any }>>}
 */
function collectGroups(schema, prefix = [], groups = new Map()) {
  const groupName = prefix.join("_");

  for (const [key, node] of Object.entries(schema)) {
    const path = [...prefix, key];
    const envKey = path.join("_");

    if (isFieldSpec(node)) {
      if (!groups.has(groupName)) {
        groups.set(groupName, []);
      }
      groups.get(groupName)?.push({ envKey, spec: /** @type {any} */ (node) });
    } else if (
      node !== null &&
      typeof node === "object" &&
      !Array.isArray(node)
    ) {
      collectGroups(/** @type {Record<string, unknown>} */ (node), path, groups);
    }
  }

  return groups;
}

/**
 * Determine the placeholder value for a variable based on type, default, and secret status.
 *
 * @param {string} envKey
 * @param {any} spec
 * @param {boolean} includeDefaults
 * @param {boolean} secret
 * @returns {string}
 */
function getPlaceholderValue(envKey, spec, includeDefaults, secret) {
  if (secret) {
    return "change-me";
  }

  if (includeDefaults && spec.default !== undefined) {
    return String(spec.default);
  }

  switch (spec.type) {
    case "number":
      return "3000";
    case "boolean":
      return "false";
    case "url":
      return "https://example.com";
    case "string":
    default:
      return "";
  }
}

/**
 * Build documentation comment lines for a variable.
 *
 * @param {any} spec
 * @param {boolean} includeDefaults
 * @param {boolean} secret
 * @returns {string[]}
 */
function buildComments(spec, includeDefaults, secret) {
  const lines = [];

  if (spec.description) {
    lines.push(`# ${spec.description}`);
  }

  let reqText = "optional";
  if (spec.required) {
    reqText = "required";
  } else if (includeDefaults && spec.default !== undefined && !secret) {
    reqText = `optional (default: ${spec.default})`;
  } else if (spec.default !== undefined && !secret) {
    reqText = `optional (default: ${spec.default})`;
  }

  lines.push(`# ${spec.type}, ${reqText}`);

  return lines;
}

/**
 * Generate a .env.example string from a schema.
 *
 * @param {Record<string, unknown>} schema
 * @param {object} [options]
 * @param {boolean} [options.includeDefaults=true] - Whether to use defaults as placeholders.
 * @returns {string}
 */
export function generateExample(schema, { includeDefaults = true } = {}) {
  const groups = collectGroups(schema);
  const sections = [];

  for (const [groupName, variables] of groups.entries()) {
    const lines = [];

    if (groupName !== "") {
      lines.push(`# ${groupName}`);
    }

    for (const { envKey, spec } of variables) {
      const secret = isSecret(envKey, spec);
      const comments = buildComments(spec, includeDefaults, secret);
      const val = getPlaceholderValue(envKey, spec, includeDefaults, secret);

      lines.push(...comments);
      lines.push(`${envKey}=${val}`);
      lines.push(""); // blank line after each variable for readability
    }

    if (lines.length > 0 && lines[lines.length - 1] === "") {
      lines.pop();
    }

    sections.push(lines.join("\n"));
  }

  return sections.join("\n\n") + (sections.length > 0 ? "\n" : "");
}
