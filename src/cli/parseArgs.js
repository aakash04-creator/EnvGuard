/**
 * @module cli/parseArgs
 * Zero-dependency argument parser for the envpilot CLI.
 */

/**
 * @typedef {Object} CliArgs
 * @property {string}   command       - The sub-command (e.g. "check").
 * @property {string}   [env]         - --env override.
 * @property {string}   [cwd]         - --cwd directory.
 * @property {string}   [config]      - --config path.
 * @property {boolean}  json          - --json flag.
 * @property {boolean}  noColor       - --no-color flag.
 * @property {boolean}  strict        - --strict flag.
 * @property {boolean}  help          - --help flag.
 * @property {boolean}  version       - --version flag.
 */

/**
 * Parse raw process.argv (from index 2 onward).
 *
 * @param {string[]} argv
 * @returns {CliArgs}
 */
export function parseArgs(argv) {
  /** @type {CliArgs} */
  const result = {
    command: "",
    json: false,
    noColor: false,
    strict: false,
    help: false,
    version: false,
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--version" || arg === "-v") {
      result.version = true;
    } else if (arg === "--json") {
      result.json = true;
    } else if (arg === "--no-color") {
      result.noColor = true;
    } else if (arg === "--strict") {
      result.strict = true;
    } else if (arg === "--env" && i + 1 < argv.length) {
      result.env = argv[++i];
    } else if (arg === "--cwd" && i + 1 < argv.length) {
      result.cwd = argv[++i];
    } else if (arg === "--config" && i + 1 < argv.length) {
      result.config = argv[++i];
    } else if (!arg.startsWith("-") && !result.command) {
      result.command = arg;
    }

    i++;
  }

  return result;
}
