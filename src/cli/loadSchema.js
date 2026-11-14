/**
 * @module cli/loadSchema
 * Load a user's envpilot config file via dynamic import.
 */
import { resolve } from "node:path";
import { existsSync } from "node:fs";

const DEFAULT_NAMES = ["envpilot.config.js", "envpilot.config.mjs"];

/**
 * Load the schema from a config file.
 *
 * @param {object} opts
 * @param {string} [opts.config] - Explicit path (--config flag).
 * @param {string} [opts.cwd]    - Working directory (default: process.cwd()).
 * @returns {Promise<Record<string, unknown>>}
 */
export async function loadSchema({ config, cwd } = {}) {
  const dir = cwd ?? process.cwd();

  if (config) {
    const full = resolve(dir, config);
    if (!existsSync(full)) {
      throw new Error(
        `Config file not found: ${full}\n\n` +
          `Create one with:\n\n` +
          `  // envpilot.config.js\n` +
          `  export default {\n` +
          `    PORT: { type: "number", default: 3000 },\n` +
          `  };\n`,
      );
    }
    return importSchema(full);
  }

  for (const name of DEFAULT_NAMES) {
    const full = resolve(dir, name);
    if (existsSync(full)) {
      return importSchema(full);
    }
  }

  throw new Error(
    `No envpilot config file found in ${dir}.\n\n` +
      `Create an envpilot.config.js with a default export:\n\n` +
      `  // envpilot.config.js\n` +
      `  export default {\n` +
      `    PORT: { type: "number", default: 3000 },\n` +
      `  };\n`,
  );
}

/**
 * @param {string} fullPath
 * @returns {Promise<Record<string, unknown>>}
 */
async function importSchema(fullPath) {
  // Use a file:// URL so dynamic import works with absolute paths on all platforms.
  const fileUrl = new URL(`file://${fullPath}`);
  const mod = await import(fileUrl.href);

  if (!mod.default || typeof mod.default !== "object") {
    throw new Error(
      `Config file ${fullPath} must have a default export (the schema object).\n\n` +
        `Example:\n\n` +
        `  export default {\n` +
        `    PORT: { type: "number", default: 3000 },\n` +
        `  };\n`,
    );
  }

  return mod.default;
}
