import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI = join(__dirname, "..", "bin", "envpilot.js");

/** Run the CLI and capture result */
function run(args = [], opts = {}) {
  try {
    const stdout = execFileSync("node", [CLI, ...args], {
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1", ...(opts.env ?? {}) },
      cwd: opts.cwd ?? process.cwd(),
      timeout: 10000,
    });
    return { code: 0, stdout, stderr: "" };
  } catch (err) {
    return {
      code: err.status ?? 1,
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
    };
  }
}

describe("CLI", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "envpilot-cli-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── Basic flags ────────────────────────────────────────────────────────────

  it("--help prints usage and exits 0", () => {
    const { code, stdout } = run(["--help"]);
    expect(code).toBe(0);
    expect(stdout).toContain("envpilot");
    expect(stdout).toContain("check");
  });

  it("--version prints a version string", () => {
    const { code, stdout } = run(["--version"]);
    expect(code).toBe(0);
    expect(stdout).toMatch(/envpilot v?\d+/);
  });

  it("unknown command exits 2", () => {
    const { code, stderr } = run(["bogus"]);
    expect(code).toBe(2);
    expect(stderr).toContain("Unknown command");
  });

  // ── check command ──────────────────────────────────────────────────────────

  it("check exits 2 when no config file exists", () => {
    const { code } = run(["check"], { cwd: tmpDir });
    expect(code).toBe(2);
  });

  it("check exits 0 with a valid schema + env", () => {
    writeFileSync(
      join(tmpDir, "envpilot.config.js"),
      `export default { PORT: { type: "number", default: 3000 } };\n`,
    );
    const { code, stdout } = run(["check", "--cwd", tmpDir]);
    expect(code).toBe(0);
    expect(stdout).toContain("valid");
  });

  it("check exits 1 when required var is missing", () => {
    writeFileSync(
      join(tmpDir, "envpilot.config.js"),
      `export default { API_KEY: { type: "string", required: true } };\n`,
    );
    const { code, stdout } = run(["check", "--cwd", tmpDir]);
    expect(code).toBe(1);
    expect(stdout).toContain("API_KEY");
  });

  it("--json outputs valid JSON with ok, environment, issues, warnings", () => {
    writeFileSync(
      join(tmpDir, "envpilot.config.js"),
      `export default { PORT: { type: "number", default: 3000 } };\n`,
    );
    const { code, stdout } = run(["check", "--cwd", tmpDir, "--json"]);
    expect(code).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.environment).toBe("development");
    expect(Array.isArray(parsed.issues)).toBe(true);
    expect(Array.isArray(parsed.warnings)).toBe(true);
  });

  it("--json reports issues when validation fails", () => {
    writeFileSync(
      join(tmpDir, "envpilot.config.js"),
      `export default { MISSING_VAR: { type: "string", required: true } };\n`,
    );
    const { code, stdout } = run(["check", "--cwd", tmpDir, "--json"]);
    expect(code).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.issues.length).toBeGreaterThan(0);
    expect(parsed.issues[0].key).toBe("MISSING_VAR");
  });

  it("--strict exits 1 on warnings even when valid", () => {
    writeFileSync(
      join(tmpDir, "envpilot.config.js"),
      `export default { PORT: { type: "number", default: 3000 } };\n`,
    );
    writeFileSync(join(tmpDir, ".env"), "NODE_ENV=production\n");
    const { code } = run(["check", "--cwd", tmpDir, "--strict", "--env", "production"]);
    // PORT uses default in production → warning → strict exit 1
    expect(code).toBe(1);
  });

  it("--no-color suppresses ANSI codes", () => {
    writeFileSync(
      join(tmpDir, "envpilot.config.js"),
      `export default { PORT: { type: "number", default: 3000 } };\n`,
    );
    const { stdout } = run(["check", "--cwd", tmpDir, "--no-color"]);
    expect(stdout).not.toMatch(/\x1b\[/);
  });

  // ── Secret safety in CLI output ────────────────────────────────────────────

  it("never reveals secret values in JSON output", () => {
    const secretVal = "ultra-secret-password-xyz123";
    writeFileSync(
      join(tmpDir, "envpilot.config.js"),
      `export default { DB_PASSWORD: { type: "number" } };\n`,
    );
    writeFileSync(join(tmpDir, ".env"), `DB_PASSWORD=${secretVal}\n`);
    const { stdout, stderr } = run(["check", "--cwd", tmpDir, "--json"]);
    expect(stdout).not.toContain(secretVal);
    expect(stderr).not.toContain(secretVal);
  });
});
