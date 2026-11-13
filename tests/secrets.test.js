import { describe, it, expect } from "vitest";
import { maskValue, isSecretKey, isSecret, redact } from "../src/secrets.js";

describe("maskValue", () => {
  it("always returns [hidden]", () => {
    expect(maskValue("anything")).toBe("[hidden]");
    expect(maskValue("")).toBe("[hidden]");
    expect(maskValue()).toBe("[hidden]");
  });

  it("never reveals length or content", () => {
    const short = maskValue("x");
    const long = maskValue("a-very-long-secret-value-that-goes-on-and-on");
    expect(short).toBe(long);
  });
});

describe("isSecretKey", () => {
  it("matches _SECRET suffix (case-insensitive)", () => {
    expect(isSecretKey("JWT_SECRET")).toBe(true);
    expect(isSecretKey("jwt_secret")).toBe(true);
    expect(isSecretKey("MY_APP_SECRET")).toBe(true);
  });

  it("matches _KEY suffix", () => {
    expect(isSecretKey("API_KEY")).toBe(true);
    expect(isSecretKey("api_key")).toBe(true);
  });

  it("matches _TOKEN suffix", () => {
    expect(isSecretKey("ACCESS_TOKEN")).toBe(true);
  });

  it("matches _PASSWORD suffix", () => {
    expect(isSecretKey("DB_PASSWORD")).toBe(true);
  });

  it("matches _PASSWD suffix", () => {
    expect(isSecretKey("DB_PASSWD")).toBe(true);
  });

  it("matches PRIVATE_KEY substring", () => {
    expect(isSecretKey("RSA_PRIVATE_KEY")).toBe(true);
    expect(isSecretKey("MY_PRIVATE_KEY_STUFF")).toBe(true);
  });

  it("does not match innocent names", () => {
    expect(isSecretKey("PORT")).toBe(false);
    expect(isSecretKey("DATABASE_URL")).toBe(false);
    expect(isSecretKey("DEBUG")).toBe(false);
    expect(isSecretKey("APP_NAME")).toBe(false);
  });
});

describe("isSecret", () => {
  it("spec.secret === false always overrides name convention", () => {
    expect(isSecret("JWT_SECRET", { secret: false })).toBe(false);
  });

  it("spec.secret === true is always secret", () => {
    expect(isSecret("HARMLESS", { secret: true })).toBe(true);
  });

  it("falls back to name convention when spec.secret is undefined", () => {
    expect(isSecret("JWT_SECRET", {})).toBe(true);
    expect(isSecret("PORT", {})).toBe(false);
  });
});

describe("redact", () => {
  it("replaces a secret value in a string", () => {
    const result = redact("connecting with password=supersecret123", ["supersecret123"]);
    expect(result).toBe("connecting with password=[hidden]");
    expect(result).not.toContain("supersecret123");
  });

  it("replaces multiple occurrences", () => {
    const result = redact("token=abc123 and again token=abc123", ["abc123"]);
    expect(result).not.toContain("abc123");
    expect(result.match(/\[hidden\]/g)).toHaveLength(2);
  });

  it("skips values shorter than 3 characters", () => {
    const result = redact("value is ok and x and ab", ["ok", "x", "ab"]);
    // "ok" (2 chars) and "x" (1 char) and "ab" (2 chars) → all skipped
    expect(result).toBe("value is ok and x and ab");
  });

  it("handles multiple distinct secrets", () => {
    const result = redact("user=alice pass=s3cr3tP@ss!", ["alice", "s3cr3tP@ss!"]);
    expect(result).not.toContain("alice");
    expect(result).not.toContain("s3cr3tP@ss!");
  });

  it("escapes regex special characters in secret values", () => {
    // Secret value contains regex metacharacters
    const secret = "p@$$w0rd.here+more";
    const result = redact(`password is ${secret} done`, [secret]);
    expect(result).toBe("password is [hidden] done");
  });

  it("returns text unchanged when secretValues is empty", () => {
    expect(redact("hello world", [])).toBe("hello world");
  });

  it("ignores non-string entries in secretValues", () => {
    // @ts-ignore intentionally passing wrong types
    expect(redact("hello", [null, 123, undefined])).toBe("hello");
  });
});
