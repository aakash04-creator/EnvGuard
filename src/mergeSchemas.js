/**
 * @module mergeSchemas
 * Utilities for merging schemas and defining schemas with early validation.
 */

import { EnvPilotError, ValidationIssue } from "./errors.js";
import { VALID_TYPES } from "./validate.js";

/**
 * Determine if a schema node is a variable specification.
 * A node is a variable spec if it has a string "type" property.
 * Otherwise, it is treated as a group.
 *
 * @param {unknown} node
 * @returns {boolean}
 */
export function isFieldSpec(node) {
  return (
    node !== null &&
    typeof node === "object" &&
    !Array.isArray(node) &&
    typeof /** @type {any} */ (node).type === "string"
  );
}

/**
 * Deep-clone a schema node to ensure merged schemas never mutate original inputs.
 *
 * @template T
 * @param {T} node
 * @returns {T}
 */
function cloneNode(node) {
  if (node === null || typeof node !== "object") {
    return node;
  }
  if (Array.isArray(node)) {
    return /** @type {any} */ (node.map((item) => cloneNode(item)));
  }
  /** @type {Record<string, unknown>} */
  const copy = {};
  for (const [key, val] of Object.entries(node)) {
    copy[key] = cloneNode(val);
  }
  return /** @type {T} */ (copy);
}

/**
 * Merge two schema objects into a new schema object.
 *
 * @param {Record<string, unknown>} target
 * @param {Record<string, unknown>} source
 * @param {string[]} [path=[]]
 * @returns {Record<string, unknown>}
 */
function mergeTwoSchemas(target, source, path = []) {
  const result = { ...target };

  for (const [key, sourceVal] of Object.entries(source)) {
    const currentPath = [...path, key];
    const pathStr = currentPath.join(".");
    const targetVal = target[key];

    if (targetVal === undefined) {
      result[key] = cloneNode(sourceVal);
      continue;
    }

    const targetIsSpec = isFieldSpec(targetVal);
    const sourceIsSpec = isFieldSpec(sourceVal);

    if (targetIsSpec && sourceIsSpec) {
      // Both are variable specs: shallow merge (later properties win)
      result[key] = {
        ...cloneNode(targetVal),
        ...cloneNode(sourceVal),
      };
    } else if (
      !targetIsSpec &&
      !sourceIsSpec &&
      typeof targetVal === "object" &&
      targetVal !== null &&
      !Array.isArray(targetVal) &&
      typeof sourceVal === "object" &&
      sourceVal !== null &&
      !Array.isArray(sourceVal)
    ) {
      // Both are groups: merge recursively
      result[key] = mergeTwoSchemas(
        /** @type {Record<string, unknown>} */ (targetVal),
        /** @type {Record<string, unknown>} */ (sourceVal),
        currentPath,
      );
    } else {
      // Conflict: one is a variable spec, the other is a group
      const targetType = targetIsSpec ? "variable spec" : "group";
      const sourceType = sourceIsSpec ? "variable spec" : "group";
      throw new EnvPilotError([
        new ValidationIssue({
          key: currentPath.join("_"),
          code: "INVALID_SCHEMA",
          message: `Schema conflict at "${pathStr}": cannot merge ${targetType} with ${sourceType}.`,
        }),
      ]);
    }
  }

  return result;
}

/**
 * Merge multiple schemas into a single schema.
 * - Later schemas override earlier ones.
 * - Groups merge recursively.
 * - Variable specs are shallow-merged.
 * - Conflicting types (spec vs group) throw an EnvPilotError.
 * - Ignores null and undefined arguments.
 * - Never mutates input schemas.
 *
 * @param {...(Record<string, unknown> | null | undefined)} schemas
 * @returns {Record<string, unknown>}
 */
export function mergeSchemas(...schemas) {
  let merged = {};

  for (const s of schemas) {
    if (s === null || s === undefined) {
      continue;
    }

    if (typeof s !== "object" || Array.isArray(s)) {
      throw new EnvPilotError([
        new ValidationIssue({
          key: "SCHEMA",
          code: "INVALID_SCHEMA",
          message: `Expected schema to be an object, received ${Array.isArray(s) ? "array" : typeof s}.`,
        }),
      ]);
    }

    merged = mergeTwoSchemas(merged, s);
  }

  return merged;
}

/**
 * Recursively validate the structural shape of a schema.
 *
 * @param {unknown} schema
 * @param {string[]} [prefix=[]]
 * @param {Map<string, string[]>} [seen=new Map()]
 */
function validateSchemaStructure(schema, prefix = [], seen = new Map()) {
  if (schema === null || typeof schema !== "object" || Array.isArray(schema)) {
    throw new EnvPilotError([
      new ValidationIssue({
        key: prefix.join("_") || "SCHEMA",
        code: "INVALID_SCHEMA",
        message: `Schema must be an object, received ${schema === null ? "null" : Array.isArray(schema) ? "array" : typeof schema}.`,
      }),
    ]);
  }

  for (const [key, node] of Object.entries(schema)) {
    const path = [...prefix, key];
    const envKey = path.join("_");

    if (node === null || typeof node !== "object" || Array.isArray(node)) {
      throw new EnvPilotError([
        new ValidationIssue({
          key: envKey,
          code: "INVALID_SCHEMA",
          message: `Invalid schema definition at "${path.join(".")}". Expected a field specification or group object.`,
        }),
      ]);
    }

    if (isFieldSpec(node)) {
      const spec = /** @type {any} */ (node);
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
    } else {
      validateSchemaStructure(node, path, seen);
    }
  }
}

/**
 * Identity helper that validates schema structure early and returns the schema.
 * Useful for typed schemas and early configuration validation in envpilot.config.js.
 *
 * @template {Record<string, unknown>} T
 * @param {T} schema
 * @returns {T}
 */
export function defineSchema(schema) {
  validateSchemaStructure(schema);
  return schema;
}
