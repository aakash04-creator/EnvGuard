/**
 * @module loadEnvFile
 * Synchronously read and parse a .env file.
 */
import { readFileSync } from "node:fs";
import { parseEnv } from "./parseEnv.js";
import { EnvPilotError, ValidationIssue } from "./errors.js";

/**
 * Read a .env file at `filePath` and parse it into a plain object.
 * Returns {} if the file does not exist.
 * Throws an EnvPilotError for any other read failure (e.g. permission denied).
 *
 * @param {string} filePath - Absolute or relative path to the .env file.
 * @returns {Record<string, string>}
 */
export function loadEnvFile(filePath) {
  try {
    const text = readFileSync(filePath, "utf8");
    return parseEnv(text);
  } catch (err) {
    if (err.code === "ENOENT") {
      return {};
    }
    throw new EnvPilotError([
      new ValidationIssue({
        key: filePath,
        code: "INVALID_SCHEMA",
        message: `Could not read env file "${filePath}": ${err.message}`,
      }),
    ]);
  }
}
