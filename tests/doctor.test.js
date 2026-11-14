import { describe, it, expect } from "vitest";
import { doctor } from "../src/doctor.js";

describe("doctor", () => {
  // ── WEAK_SECRET ─────────────────────────────────────────────────────────────
  describe("WEAK_SECRET", () => {
    it("warns when a secret is shorter than 16 characters", () => {
      const warnings = doctor({
        config: { JWT_SECRET: "short" },
        schema: { JWT_SECRET: { type: "string" } },
        fields: [
          { envKey: "JWT_SECRET", path: ["JWT_SECRET"], spec: { type: "string" } },
        ],
        env: { JWT_SECRET: "short" },
        environment: "development",
      });
      const w = warnings.find((w) => w.code === "WEAK_SECRET");
      expect(w).toBeDefined();
      expect(w.key).toBe("JWT_SECRET");
      expect(w.message).toContain("5 characters");
    });

    it("does NOT warn when secret is 16+ characters", () => {
      const longVal = "abcdefghijklmnop"; // 16 chars
      const warnings = doctor({
        config: { JWT_SECRET: longVal },
        schema: { JWT_SECRET: { type: "string" } },
        fields: [
          { envKey: "JWT_SECRET", path: ["JWT_SECRET"], spec: { type: "string" } },
        ],
        env: { JWT_SECRET: longVal },
        environment: "development",
      });
      expect(warnings.find((w) => w.code === "WEAK_SECRET")).toBeUndefined();
    });
  });

  // ── DEBUG_IN_PRODUCTION ─────────────────────────────────────────────────────
  describe("DEBUG_IN_PRODUCTION", () => {
    it("warns when a DEBUG boolean is true in production", () => {
      const warnings = doctor({
        config: { DEBUG: true },
        schema: { DEBUG: { type: "boolean" } },
        fields: [
          { envKey: "DEBUG", path: ["DEBUG"], spec: { type: "boolean" } },
        ],
        env: { DEBUG: "true" },
        environment: "production",
      });
      const w = warnings.find((w) => w.code === "DEBUG_IN_PRODUCTION");
      expect(w).toBeDefined();
      expect(w.key).toBe("DEBUG");
    });

    it("does NOT warn in development", () => {
      const warnings = doctor({
        config: { DEBUG: true },
        schema: { DEBUG: { type: "boolean" } },
        fields: [
          { envKey: "DEBUG", path: ["DEBUG"], spec: { type: "boolean" } },
        ],
        env: { DEBUG: "true" },
        environment: "development",
      });
      expect(warnings.find((w) => w.code === "DEBUG_IN_PRODUCTION")).toBeUndefined();
    });

    it("does NOT warn when DEBUG is false in production", () => {
      const warnings = doctor({
        config: { DEBUG: false },
        schema: { DEBUG: { type: "boolean" } },
        fields: [
          { envKey: "DEBUG", path: ["DEBUG"], spec: { type: "boolean" } },
        ],
        env: { DEBUG: "false" },
        environment: "production",
      });
      expect(warnings.find((w) => w.code === "DEBUG_IN_PRODUCTION")).toBeUndefined();
    });
  });

  // ── LOCALHOST_IN_PRODUCTION ─────────────────────────────────────────────────
  describe("LOCALHOST_IN_PRODUCTION", () => {
    it("warns when a URL points to localhost in production", () => {
      const warnings = doctor({
        config: { API_URL: "http://localhost:3000" },
        schema: { API_URL: { type: "url" } },
        fields: [
          { envKey: "API_URL", path: ["API_URL"], spec: { type: "url" } },
        ],
        env: { API_URL: "http://localhost:3000" },
        environment: "production",
      });
      const w = warnings.find((w) => w.code === "LOCALHOST_IN_PRODUCTION");
      expect(w).toBeDefined();
    });

    it("warns for 127.0.0.1 too", () => {
      const warnings = doctor({
        config: { DB_URL: "http://127.0.0.1:5432" },
        schema: { DB_URL: { type: "url" } },
        fields: [
          { envKey: "DB_URL", path: ["DB_URL"], spec: { type: "url" } },
        ],
        env: { DB_URL: "http://127.0.0.1:5432" },
        environment: "production",
      });
      expect(warnings.find((w) => w.code === "LOCALHOST_IN_PRODUCTION")).toBeDefined();
    });

    it("does NOT warn for a remote host", () => {
      const warnings = doctor({
        config: { API_URL: "https://api.example.com" },
        schema: { API_URL: { type: "url" } },
        fields: [
          { envKey: "API_URL", path: ["API_URL"], spec: { type: "url" } },
        ],
        env: { API_URL: "https://api.example.com" },
        environment: "production",
      });
      expect(warnings.find((w) => w.code === "LOCALHOST_IN_PRODUCTION")).toBeUndefined();
    });
  });

  // ── DEFAULT_IN_PRODUCTION ──────────────────────────────────────────────────
  describe("DEFAULT_IN_PRODUCTION", () => {
    it("warns when a default is used in production", () => {
      const warnings = doctor({
        config: { PORT: 3000 },
        schema: { PORT: { type: "number", default: 3000 } },
        fields: [
          {
            envKey: "PORT",
            path: ["PORT"],
            spec: { type: "number", default: 3000 },
          },
        ],
        env: {}, // PORT is missing → fell back to default
        environment: "production",
      });
      const w = warnings.find((w) => w.code === "DEFAULT_IN_PRODUCTION");
      expect(w).toBeDefined();
      expect(w.key).toBe("PORT");
    });

    it("does NOT warn when value is explicitly set", () => {
      const warnings = doctor({
        config: { PORT: 8080 },
        schema: { PORT: { type: "number", default: 3000 } },
        fields: [
          {
            envKey: "PORT",
            path: ["PORT"],
            spec: { type: "number", default: 3000 },
          },
        ],
        env: { PORT: "8080" },
        environment: "production",
      });
      expect(warnings.find((w) => w.code === "DEFAULT_IN_PRODUCTION")).toBeUndefined();
    });
  });
});
