import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createConfig, createConfigWithReport } from "../src/createConfig.js";
import { mergeSchemas, defineSchema } from "../src/mergeSchemas.js";
import { generateExample } from "../src/generateExample.js";
import { parseEnv } from "../src/parseEnv.js";
import { EnvPilotError } from "../src/errors.js";

describe("Integration & Edge Cases", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "envpilot-integration-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── 1. Full Integration Test ──────────────────────────────────────────────
  it("runs createConfig with multiple .env files, profiles, merged schemas, and custom validators", () => {
    // Write multiple .env files with cascading precedence
    writeFileSync(
      join(tmpDir, ".env"),
      [
        "APP_NAME=DefaultApp",
        "PORT=3000",
        "DATABASE_HOST=localhost",
        "DATABASE_PORT=5432",
        "DATABASE_URL=postgres://localhost:5432/dev",
        "API_SECRET=dev-secret-key-12345",
      ].join("\n"),
    );

    writeFileSync(
      join(tmpDir, ".env.production"),
      [
        "DATABASE_HOST=db.prod.internal",
        "DATABASE_URL=postgres://db.prod.internal:5432/prod",
      ].join("\n"),
    );

    writeFileSync(
      join(tmpDir, ".env.local"),
      ["PORT=4000"].join("\n"),
    );

    const baseSchema = {
      APP_NAME: { type: "string" },
      PORT: { type: "number", default: 3000 },
      DATABASE: {
        HOST: { type: "string" },
        PORT: { type: "number" },
        URL: { type: "url" },
      },
    };

    const authSchema = {
      API_SECRET: {
        type: "string",
        secret: true,
        profiles: {
          production: {
            required: true,
            validate: (v) => v.length >= 16 || "Must be at least 16 chars",
          },
        },
      },
      DEBUG: {
        type: "boolean",
        default: false,
        profiles: {
          development: { default: true },
        },
      },
    };

    const schema = mergeSchemas(baseSchema, authSchema);

    // Run in development:
    const devConfig = createConfig(schema, {
      cwd: tmpDir,
      environment: "development",
    });

    expect(devConfig.APP_NAME).toBe("DefaultApp");
    expect(devConfig.PORT).toBe(4000); // .env.local wins over .env
    expect(devConfig.DATABASE.HOST).toBe("localhost");
    expect(devConfig.DEBUG).toBe(true); // development profile default
    expect(devConfig.API_SECRET).toBe("dev-secret-key-12345");

    // Run in production:
    const prodConfig = createConfig(schema, {
      cwd: tmpDir,
      environment: "production",
      env: {
        PORT: "8080", // process.env override wins over all files
        API_SECRET: "prod-ultra-secure-key-987654321",
      },
    });

    expect(prodConfig.PORT).toBe(8080);
    expect(prodConfig.DATABASE.HOST).toBe("db.prod.internal");
    expect(prodConfig.DATABASE.URL).toBe("postgres://db.prod.internal:5432/prod");
    expect(prodConfig.DEBUG).toBe(false);
    expect(prodConfig.API_SECRET).toBe("prod-ultra-secure-key-987654321");
  });

  // ── 2. Edge Cases ─────────────────────────────────────────────────────────

  it("handles empty schema", () => {
    const config = createConfig({}, { envFile: false, env: {} });
    expect(config).toEqual({});
    expect(Object.isFrozen(config)).toBe(true);
  });

  it("handles deeply nested groups", () => {
    const schema = {
      SERVICES: {
        AUTH: {
          DATABASE: {
            POOL: {
              MAX_CLIENTS: { type: "number", default: 10 },
            },
          },
        },
      },
    };

    const config = createConfig(schema, {
      envFile: false,
      env: { SERVICES_AUTH_DATABASE_POOL_MAX_CLIENTS: "25" },
    });

    expect(config.SERVICES.AUTH.DATABASE.POOL.MAX_CLIENTS).toBe(25);
    expect(Object.isFrozen(config.SERVICES.AUTH.DATABASE.POOL)).toBe(true);
  });

  it("detects duplicate env-var names produced by different schema paths", () => {
    const schema = {
      AUTH_TOKEN: { type: "string" },
      AUTH: {
        TOKEN: { type: "string" },
      },
    };

    expect(() => createConfig(schema, { envFile: false, env: {} })).toThrow(
      EnvPilotError,
    );
  });

  it("parses CRLF and UTF-8 BOM properly in .env files", () => {
    const content = "\uFEFFAPP_KEY=12345\r\nAPP_NAME='EnvPilot App'\r\n";
    const parsed = parseEnv(content);
    expect(parsed.APP_KEY).toBe("12345");
    expect(parsed.APP_NAME).toBe("EnvPilot App");
  });

  it("catches thrown error in custom validator and records CUSTOM_VALIDATION", () => {
    const schema = {
      COUNT: {
        type: "number",
        validate: () => {
          throw new Error("Validation exploded");
        },
      },
    };

    try {
      createConfig(schema, { envFile: false, env: { COUNT: "5" } });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(EnvPilotError);
      expect(err.issues[0].code).toBe("CUSTOM_VALIDATION");
      expect(err.issues[0].message).toContain("Validation exploded");
    }
  });

  it("redacts secret value when thrown validator error message contains the secret", () => {
    const secretValue = "top-secret-clearance-code-999";
    const schema = {
      SECRET_TOKEN: {
        type: "string",
        secret: true,
        validate: (val) => {
          throw new Error(`Rejected bad secret: ${val}`);
        },
      },
    };

    try {
      createConfig(schema, { envFile: false, env: { SECRET_TOKEN: secretValue } });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(EnvPilotError);
      const str = JSON.stringify(err);
      expect(str).not.toContain(secretValue);
      expect(err.issues[0].message).toContain("[hidden]");
    }
  });

  // ── 3. Schema Merging & Definition ────────────────────────────────────────

  it("mergeSchemas skips null and undefined arguments", () => {
    const a = { PORT: { type: "number", default: 3000 } };
    const b = { HOST: { type: "string", default: "localhost" } };
    const merged = mergeSchemas(null, a, undefined, b);
    expect(merged.PORT.default).toBe(3000);
    expect(merged.HOST.default).toBe("localhost");
  });

  it("mergeSchemas throws on non-object arguments", () => {
    expect(() => mergeSchemas("not-an-object")).toThrow(EnvPilotError);
    expect(() => mergeSchemas(123)).toThrow(EnvPilotError);
    expect(() => mergeSchemas([])).toThrow(EnvPilotError);
  });

  it("mergeSchemas throws when merging a variable spec with a group", () => {
    const a = { DB: { type: "string" } };
    const b = { DB: { HOST: { type: "string" } } };
    expect(() => mergeSchemas(a, b)).toThrow(EnvPilotError);
  });

  it("defineSchema returns schema on success and throws on invalid schema", () => {
    const valid = defineSchema({ PORT: { type: "number" } });
    expect(valid).toBeDefined();

    expect(() => defineSchema("invalid")).toThrow(EnvPilotError);
    expect(() => defineSchema({ BAD: { type: "invalid_type" } })).toThrow(
      EnvPilotError,
    );
  });

  // ── 4. Profile Overrides ──────────────────────────────────────────────────

  it("profile removes default value when default: undefined is set", () => {
    const schema = {
      API_KEY: {
        type: "string",
        default: "dev-key",
        profiles: {
          production: {
            default: undefined,
            required: true,
          },
        },
      },
    };

    // Dev uses default:
    const devCfg = createConfig(schema, {
      envFile: false,
      env: {},
      environment: "development",
    });
    expect(devCfg.API_KEY).toBe("dev-key");

    // Prod requires it because default was deleted:
    expect(() =>
      createConfig(schema, {
        envFile: false,
        env: {},
        environment: "production",
      }),
    ).toThrow(EnvPilotError);
  });

  it("throws on unknown profile name", () => {
    const schema = {
      PORT: {
        type: "number",
        profiles: {
          staging: { default: 8080 }, // "staging" is not allowed
        },
      },
    };

    expect(() =>
      createConfig(schema, { envFile: false, env: { PORT: "3000" } }),
    ).toThrow(EnvPilotError);
  });

  // ── 5. .env.example Generation ────────────────────────────────────────────

  it("generates formatted .env.example with groups and placeholder values", () => {
    const schema = {
      APP_NAME: { type: "string", description: "Application name" },
      PORT: { type: "number", default: 3000 },
      JWT_SECRET: { type: "string", secret: true, required: true },
      DATABASE: {
        URL: { type: "url", required: true },
        POOL_SIZE: { type: "number", default: 10 },
      },
    };

    const example = generateExample(schema);
    expect(example).toContain("# Application name");
    expect(example).toContain("PORT=3000");
    expect(example).toContain("JWT_SECRET=change-me"); // secret placeholder
    expect(example).toContain("# DATABASE");
    expect(example).toContain("DATABASE_URL=https://example.com");
    expect(example).toContain("DATABASE_POOL_SIZE=10");
  });

  it("createConfigWithReport returns null config and populates issues when validation fails", async () => {
    const report = await createConfigWithReport(
      { PORT: { type: "number", required: true } },
      { envFile: false, env: {} },
    );
    expect(report.config).toBeNull();
    expect(report.issues.length).toBeGreaterThan(0);
    expect(report.issues[0].key).toBe("PORT");
  });
});
