/**
 * @module parseEnv
 * Parse the text content of a .env file into a plain object.
 *
 * Rules:
 *  - Blank lines and lines whose first non-whitespace character is '#' are skipped.
 *  - Optional leading "export " prefix is stripped before parsing.
 *  - KEY=value  — value is unquoted; trimmed; inline comment " #..." stripped.
 *  - KEY='val'  — single-quoted; value is literal (no escape processing).
 *  - KEY="val"  — double-quoted; supports \n \t \" \\ escape sequences.
 *  - KEY=       — empty string.
 *  - Duplicate keys: last one wins.
 *  - Malformed lines are silently ignored.
 *  - Handles CRLF line endings and a leading UTF-8 BOM.
 */

/** @typedef {Record<string, string>} EnvMap */

const DOUBLE_QUOTE_ESCAPE = {
  n: "\n",
  t: "\t",
  '"': '"',
  "\\": "\\",
};

/**
 * Process escape sequences inside a double-quoted value.
 * Unknown escapes are kept as-is (backslash + char).
 *
 * @param {string} raw - Content between the outer double-quotes.
 * @returns {string}
 */
function processDoubleQuoteEscapes(raw) {
  return raw.replace(/\\([\s\S])/g, (_, ch) => DOUBLE_QUOTE_ESCAPE[ch] ?? `\\${ch}`);
}

/**
 * Strip an inline comment from an unquoted value.
 * A comment starts at the first occurrence of " #" (space then hash).
 *
 * @param {string} raw - Trimmed unquoted value.
 * @returns {string}
 */
function stripInlineComment(raw) {
  const idx = raw.indexOf(" #");
  return idx === -1 ? raw : raw.slice(0, idx);
}

/**
 * Parse the text content of a .env file and return a plain object.
 * Never throws — malformed lines are silently skipped.
 *
 * @param {string} text - Raw file contents.
 * @returns {EnvMap}
 */
export function parseEnv(text) {
  /** @type {EnvMap} */
  const result = {};

  // Strip leading UTF-8 BOM if present.
  const normalized = text.replace(/^\uFEFF/, "");

  // Split on CRLF or LF.
  const lines = normalized.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip blank lines.
    if (line.length === 0) {
      continue;
    }

    // Skip comment lines.
    if (line.startsWith("#")) {
      continue;
    }

    // Strip optional "export " prefix.
    const stripped = line.startsWith("export ") ? line.slice(7).trim() : line;

    // Must contain "=".
    const eqIdx = stripped.indexOf("=");
    if (eqIdx === -1) {
      continue;
    }

    const key = stripped.slice(0, eqIdx).trim();

    // Keys must be non-empty and consist of word characters.
    if (!key || !/^\w+$/.test(key)) {
      continue;
    }

    const rest = stripped.slice(eqIdx + 1);

    let value;

    if (rest.startsWith("'")) {
      // Single-quoted: find closing quote; literal content.
      const closing = rest.indexOf("'", 1);
      if (closing === -1) {
        continue; // Malformed — no closing quote.
      }
      value = rest.slice(1, closing);
    } else if (rest.startsWith('"')) {
      // Double-quoted: find closing quote respecting backslash escapes.
      let i = 1;
      let raw = "";
      let closed = false;
      while (i < rest.length) {
        const ch = rest[i];
        if (ch === "\\") {
          raw += rest[i] + (rest[i + 1] ?? "");
          i += 2;
        } else if (ch === '"') {
          closed = true;
          break;
        } else {
          raw += ch;
          i++;
        }
      }
      if (!closed) {
        continue; // Malformed.
      }
      value = processDoubleQuoteEscapes(raw);
    } else {
      // Unquoted: trim and strip inline comment.
      value = stripInlineComment(rest.trim()).trimEnd();
    }

    result[key] = value;
  }

  return result;
}
