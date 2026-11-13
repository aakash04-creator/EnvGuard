// JSDoc type definitions shared across the EnvPilot codebase.

/**
 * Supported field types.
 * @typedef {"string" | "number" | "boolean" | "url"} FieldType
 */

/**
 * Definition for a single config field.
 * @typedef {Object} FieldSchema
 * @property {FieldType} type                 - Expected type.
 * @property {boolean}   [required]           - Whether the value must be present.
 * @property {*}         [default]            - Fallback value when the variable is absent.
 * @property {boolean}   [secret]             - Treat as sensitive (value hidden in errors). Auto-detected from name if omitted.
 * @property {string}    [description]        - Human-readable description, included in error messages.
 * @property {Function}  [validate]           - Custom validator: (value, ctx) => true | false | string | throws.
 */

/**
 * Full schema map passed to createConfig.
 * Schema nodes are either FieldSchema objects (have a "type" property) or
 * nested groups (plain objects without "type"). Groups can nest to any depth.
 *
 * ⚠️  Limitation: a group cannot contain a variable literally named "type".
 *
 * @typedef {Record<string, FieldSchema | Record<string, unknown>>} Schema
 */

/**
 * Options accepted by createConfig / createConfigWithReport.
 * @typedef {Object} CreateConfigOptions
 * @property {Record<string, string | undefined>} [env]         - Environment to read from (defaults to process.env).
 * @property {boolean}                            [envFile]     - Set false to skip .env file loading (default: true).
 * @property {string}                             [cwd]         - Directory to look for .env files (default: process.cwd()).
 * @property {string}                             [environment] - Explicit environment override (development|test|production).
 */
