import { describe, it, expect } from "vitest";
import { parseEnv } from "../src/parseEnv.js";

describe("parseEnv", () => {
  // ── Basic key=value ───────────────────────────────────────────────────────
  it("parses a simple key=value pair", () => {
    expect(parseEnv("FOO=bar")).toEqual({ FOO: "bar" });
  });

  it("parses multiple keys", () => {
    expect(parseEnv("A=1\nB=2\nC=3")).toEqual({ A: "1", B: "2", C: "3" });
  });

  it("empty value gives empty string", () => {
    expect(parseEnv("KEY=")).toEqual({ KEY: "" });
  });

  it("trims whitespace around unquoted keys and values", () => {
    expect(parseEnv("  FOO = bar  ")).toEqual({ FOO: "bar" });
  });

  // ── Comments & blank lines ────────────────────────────────────────────────
  it("skips blank lines", () => {
    expect(parseEnv("\nFOO=bar\n\n")).toEqual({ FOO: "bar" });
  });

  it("skips comment lines starting with #", () => {
    expect(parseEnv("# comment\nFOO=bar")).toEqual({ FOO: "bar" });
  });

  it("skips inline # comment in unquoted values", () => {
    expect(parseEnv("FOO=bar # this is a comment")).toEqual({ FOO: "bar" });
  });

  it("does NOT strip # that is not preceded by a space", () => {
    expect(parseEnv("FOO=bar#notacomment")).toEqual({ FOO: "bar#notacomment" });
  });

  // ── export prefix ─────────────────────────────────────────────────────────
  it("strips optional export prefix", () => {
    expect(parseEnv("export FOO=bar")).toEqual({ FOO: "bar" });
  });

  // ── Single-quoted values ──────────────────────────────────────────────────
  it("single-quoted: literal value with no escape processing", () => {
    expect(parseEnv("FOO='hello world'")).toEqual({ FOO: "hello world" });
  });

  it("single-quoted: backslash is literal", () => {
    expect(parseEnv("FOO='path\\to\\file'")).toEqual({ FOO: "path\\to\\file" });
  });

  it("single-quoted: # is not a comment", () => {
    expect(parseEnv("FOO='bar # still value'")).toEqual({ FOO: "bar # still value" });
  });

  it("single-quoted: empty string", () => {
    expect(parseEnv("FOO=''")).toEqual({ FOO: "" });
  });

  it("ignores malformed single-quoted (no closing quote)", () => {
    expect(parseEnv("FOO='unclosed")).toEqual({});
  });

  // ── Double-quoted values ──────────────────────────────────────────────────
  it("double-quoted: basic value", () => {
    expect(parseEnv('FOO="hello world"')).toEqual({ FOO: "hello world" });
  });

  it("double-quoted: \\n escape", () => {
    expect(parseEnv('FOO="line1\\nline2"')).toEqual({ FOO: "line1\nline2" });
  });

  it("double-quoted: \\t escape", () => {
    expect(parseEnv('FOO="col1\\tcol2"')).toEqual({ FOO: "col1\tcol2" });
  });

  it('double-quoted: \\" escape', () => {
    expect(parseEnv('FOO="say \\"hi\\""')).toEqual({ FOO: 'say "hi"' });
  });

  it("double-quoted: \\\\ escape", () => {
    expect(parseEnv('FOO="back\\\\slash"')).toEqual({ FOO: "back\\slash" });
  });

  it("double-quoted: unknown escape kept as-is", () => {
    expect(parseEnv('FOO="\\z"')).toEqual({ FOO: "\\z" });
  });

  it("double-quoted: # inside is not a comment", () => {
    expect(parseEnv('FOO="bar # still"')).toEqual({ FOO: "bar # still" });
  });

  it("ignores malformed double-quoted (no closing quote)", () => {
    expect(parseEnv('FOO="unclosed')).toEqual({});
  });

  // ── Duplicate keys ────────────────────────────────────────────────────────
  it("last duplicate key wins", () => {
    expect(parseEnv("FOO=first\nFOO=second")).toEqual({ FOO: "second" });
  });

  // ── Line endings ──────────────────────────────────────────────────────────
  it("handles CRLF line endings", () => {
    expect(parseEnv("A=1\r\nB=2\r\n")).toEqual({ A: "1", B: "2" });
  });

  // ── BOM ───────────────────────────────────────────────────────────────────
  it("strips a leading UTF-8 BOM", () => {
    expect(parseEnv("\uFEFFFOO=bar")).toEqual({ FOO: "bar" });
  });

  // ── Malformed lines ───────────────────────────────────────────────────────
  it("ignores lines with no = sign", () => {
    expect(parseEnv("NOEQUALSSIGN\nFOO=bar")).toEqual({ FOO: "bar" });
  });

  it("ignores lines with invalid key characters", () => {
    // hyphen not allowed in env key identifiers by the spec
    expect(parseEnv("MY-KEY=val\nGOOD=ok")).toEqual({ GOOD: "ok" });
  });

  // ── Empty input ───────────────────────────────────────────────────────────
  it("returns empty object for empty input", () => {
    expect(parseEnv("")).toEqual({});
  });

  it("returns empty object for whitespace-only input", () => {
    expect(parseEnv("   \n  \n")).toEqual({});
  });
});
