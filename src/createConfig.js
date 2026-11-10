// createConfig – main entry point for schema-based config validation.
// Implementation added in a later commit.

/**
 * @typedef {import("./types.js").Schema} Schema
 * @typedef {import("./types.js").CreateConfigOptions} CreateConfigOptions
 */

/**
 * Validate environment variables against a schema and return a frozen config object.
 *
 * @param {Schema} schema
 * @param {CreateConfigOptions} [options]
 * @returns {Record<string, unknown>}
 */
export function createConfig(schema, options = {}) {
  throw new Error("createConfig: not yet implemented");
}

