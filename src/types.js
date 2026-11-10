// JSDoc type definitions shared across the EnvPilot codebase.

/**
 * Supported field types.
 * @typedef {"string" | "number" | "boolean" | "url"} FieldType
 */

/**
 * Definition for a single config field.
 * @typedef {Object} FieldSchema
 * @property {FieldType} type          - Expected type.
 * @property {boolean}  [required]     - Whether the value must be present.
 * @property {*}        [default]      - Fallback value when the variable is absent.
 * @property {boolean}  [secret]       - Treat as sensitive (value hidden in errors).
 */

/**
 * Full schema map passed to createConfig.
 * @typedef {Record<string, FieldSchema>} Schema
 */

/**
 * Options accepted by createConfig.
 * @typedef {Object} CreateConfigOptions
 * @property {Record<string, string | undefined>} [env] - Environment to read from (defaults to process.env).
 */

