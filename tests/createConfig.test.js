import { describe, it, expect } from "vitest";
import { createConfig } from "../src/createConfig.js";
import { EnvPilotError } from "../src/errors.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Run createConfig with a custom env, suppressing .env file loading */
function run(schema, env) {
  return createConfig(schema, { env, envFile: false });
}

/** Expect createConfig to throw and return the EnvPilotError */
function getError(schema, env) {
  try {
    run(schema, env);
    throw new Error("Expected createConfig to throw");
  } catch (err) {
    if (err instanceof EnvPilotError) return err;
    throw err;
  }
}

// ─── Type coercion ────────────────────────────────────────────────────────────

describe("createConfig – type coercion", () => {
  it("coerces a string field", () => {
    const cfg = run({ APP_NAME: { type: "string" } }, { APP_NAME: "envpilot" });
    expect(cfg.APP_NAME).toBe("envpilot");
  });

  it("coerces a number field", () => {
    const cfg = run({ PORT: { type: "number" } }, { PORT: "3000" });
    expect(cfg.PORT).toBe(3000);
  });

  it("coerces boolean true values", () => {
    for (const v of ["true", "1", "yes", "TRUE", "YES"]) {
      const cfg = run({ DEBUG: { type: "boolean" } }, { DEBUG: v });
      expect(cfg.DEBUG).toBe(true);
    }
  });

  it("coerces boolean false values", () => {
    for (const v of ["false", "0", "no", "FALSE", "NO"]) {
      const cfg = run({ DEBUG: { type: "boolean" } }, { DEBUG: v });
      expect(cfg.DEBUG).toBe(false);
    }
  });

  it("coerces a url field", () => {
    const cfg = run(
      { DATABASE_URL: { type: "url" } },
      { DATABASE_URL: "https://db.example.com/mydb" },
    );
    expect(cfg.DATABASE_URL).toBe("https://db.example.com/mydb");
  });
});

// ─── Required / missing ───────────────────────────────────────────────────────

describe("createConfig – required & missing", () => {
  it("throws MISSING for a required field", () => {
    const err = getError({ TOKEN: { type: "string", required: true } }, {});
    expect(err.issues).toHaveLength(1);
    expect(err.issues[0].code).toBe("MISSING");
    expect(err.issues[0].key).toBe("TOKEN");
  });

  it("empty string is treated as missing", () => {
    const err = getError({ TOKEN: { type: "string", required: true } }, { TOKEN: "" });
    expect(err.issues[0].code).toBe("MISSING");
  });

  it("optional field without a value is undefined in output", () => {
    const cfg = run({ FEATURE: { type: "string" } }, {});
    expect(cfg.FEATURE).toBeUndefined();
  });

  it("collects ALL issues before throwing", () => {
    const schema = {
      A: { type: "string", required: true },
      B: { type: "number", required: true },
      C: { type: "boolean", required: true },
    };
    const err = getError(schema, {});
    expect(err.issues).toHaveLength(3);
  });
});

// ─── Defaults ─────────────────────────────────────────────────────────────────

describe("createConfig – defaults", () => {
  it("uses the default when value is absent", () => {
    const cfg = run({ PORT: { type: "number", default: 3000 } }, {});
    expect(cfg.PORT).toBe(3000);
  });

  it("type-checks the default value", () => {
    const err = getError({ PORT: { type: "number", default: "not-a-number" } }, {});
    expect(err.issues[0].code).toBe("INVALID_TYPE");
  });

  it("env value overrides the default", () => {
    const cfg = run({ PORT: { type: "number", default: 3000 } }, { PORT: "8080" });
    expect(cfg.PORT).toBe(8080);
  });
});

// ─── Frozen result ────────────────────────────────────────────────────────────

describe("createConfig – frozen result", () => {
  it("returned config is frozen", () => {
    const cfg = run({ PORT: { type: "number" } }, { PORT: "3000" });
    expect(Object.isFrozen(cfg)).toBe(true);
  });

  it("nested objects are also frozen", () => {
    const schema = { DATABASE: { HOST: { type: "string" } } };
    const cfg = run(schema, { DATABASE_HOST: "localhost" });
    expect(Object.isFrozen(cfg.DATABASE)).toBe(true);
  });
});

// ─── Nested config ────────────────────────────────────────────────────────────

describe("createConfig – nested config", () => {
  it("maps nested schema to underscore env keys", () => {
    const schema = {
      DATABASE: {
        HOST: { type: "string" },
        PORT: { type: "number" },
      },
    };
    const cfg = run(schema, { DATABASE_HOST: "localhost", DATABASE_PORT: "5432" });
    expect(cfg.DATABASE.HOST).toBe("localhost");
    expect(cfg.DATABASE.PORT).toBe(5432);
  });

  it("issue.key is the full underscore path", () => {
    const schema = { DATABASE: { URL: { type: "url", required: true } } };
    const err = getError(schema, {});
    expect(err.issues[0].key).toBe("DATABASE_URL");
  });

  it("throws INVALID_SCHEMA for duplicate env-var paths", () => {
    // DATABASE_URL can come from { DATABASE: { URL } } and { DATABASE_URL: ... }
    const schema = {
      DATABASE: { URL: { type: "string" } },
      DATABASE_URL: { type: "string" },
    };
    expect(() => run(schema, {})).toThrow(EnvPilotError);
  });
});

// ─── Schema validation ────────────────────────────────────────────────────────

describe("createConfig – schema validation", () => {
  it("throws INVALID_SCHEMA for unknown type", () => {
    // @ts-ignore intentional bad type
    const err = getError({ FOO: { type: "uuid" } }, {});
    expect(err.issues[0].code).toBe("INVALID_SCHEMA");
  });

  it("throws INVALID_SCHEMA when validate is not a function", () => {
    // @ts-ignore
    const err = getError({ FOO: { type: "string", validate: "oops" } }, { FOO: "x" });
    expect(err.issues[0].code).toBe("INVALID_SCHEMA");
  });
});

// ─── Custom validators ────────────────────────────────────────────────────────

describe("createConfig – custom validators", () => {
  it("passes when validate returns true", () => {
    const cfg = run(
      { PORT: { type: "number", validate: (v) => v > 0 || "must be positive" } },
      { PORT: "3000" },
    );
    expect(cfg.PORT).toBe(3000);
  });

  it("records CUSTOM_VALIDATION when validate returns false", () => {
    const err = getError(
      { PORT: { type: "number", validate: () => false } },
      { PORT: "0" },
    );
    expect(err.issues[0].code).toBe("CUSTOM_VALIDATION");
  });

  it("records CUSTOM_VALIDATION with string message", () => {
    const err = getError(
      { PORT: { type: "number", validate: (v) => (v > 0 ? true : "must be positive") } },
      { PORT: "0" },
    );
    expect(err.issues[0].message).toContain("must be positive");
  });

  it("records CUSTOM_VALIDATION when validate throws", () => {
    const err = getError(
      {
        PORT: {
          type: "number",
          validate: () => {
            throw new Error("boom");
          },
        },
      },
      { PORT: "3000" },
    );
    expect(err.issues[0].code).toBe("CUSTOM_VALIDATION");
    expect(err.issues[0].message).toContain("boom");
  });

  it("skips validate when field is missing/optional", () => {
    const validate = () => false; // would fail if called
    const cfg = run({ OPTIONAL: { type: "string", validate } }, {});
    expect(cfg.OPTIONAL).toBeUndefined();
  });
});

// ─── SECRET MASKING (the critical end-to-end test) ────────────────────────────

describe("createConfig – secret masking enforcement", () => {
  const SECRET_VALUE = "s3cr3t-jwt-t0ken-xYz!@#";

  it("masks received in INVALID_TYPE issue for _SECRET key", () => {
    const err = getError(
      { JWT_SECRET: { type: "number" } },
      { JWT_SECRET: SECRET_VALUE },
    );
    const issue = err.issues[0];
    expect(issue.received).toBe("[hidden]");
    expect(issue.received).not.toContain(SECRET_VALUE);
  });

  it("masks received in INVALID_TYPE issue for spec.secret:true", () => {
    const err = getError(
      { MY_PASS: { type: "number", secret: true } },
      { MY_PASS: SECRET_VALUE },
    );
    expect(err.issues[0].received).toBe("[hidden]");
  });

  it("secret value NEVER appears anywhere in the serialized error", () => {
    const err = getError(
      { JWT_SECRET: { type: "number" } },
      { JWT_SECRET: SECRET_VALUE },
    );
    // Scan: error message, all issues stringified, full JSON
    const full = JSON.stringify({
      message: err.message,
      issues: err.issues,
    });
    expect(full).not.toContain(SECRET_VALUE);
  });

  it("custom validator error messages are redacted for secrets", () => {
    const secretVal = "my-super-secret-token-abc";
    const err = getError(
      {
        AUTH_TOKEN: {
          type: "string",
          validate: (v) => {
            throw new Error(`Bad value: ${v}`); // would leak secret
          },
        },
      },
      { AUTH_TOKEN: secretVal },
    );
    const full = JSON.stringify({ message: err.message, issues: err.issues });
    expect(full).not.toContain(secretVal);
  });

  it("non-secret field received value IS shown", () => {
    const err = getError({ PORT: { type: "number" } }, { PORT: "not-a-number" });
    expect(err.issues[0].received).toContain("not-a-number");
  });

  it("spec.secret:false overrides name convention — value shown in errors", () => {
    const err = getError(
      { MY_SECRET: { type: "number", secret: false } },
      { MY_SECRET: "oops" },
    );
    expect(err.issues[0].received).toContain("oops");
  });
});
