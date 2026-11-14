# envpilot

> Lightweight environment-variable validation for Node.js — catch config errors before they reach production.

EnvPilot validates your environment variables at startup and explains **what** is wrong, **why** it matters, and **how to fix it**. Zero runtime dependencies. Works with plain JavaScript or TypeScript via JSDoc types.

## Install

```bash
npm install envpilot
```

## Quick Start

```js
// envpilot.config.js
export default {
  PORT: { type: "number", default: 3000 },
  DATABASE_URL: { type: "url", required: true },
  JWT_SECRET: { type: "string", required: true, secret: true },
  DEBUG: { type: "boolean", default: false },
};
```

```js
// app.js
import { createConfig } from "envpilot";
import schema from "./envpilot.config.js";

const config = createConfig(schema);
console.log(config.PORT); // 3000 (number)
```

If `DATABASE_URL` or `JWT_SECRET` are missing, you get a clear error:

```
EnvPilot found 2 issue(s):

[MISSING] DATABASE_URL: Required variable "DATABASE_URL" is missing or empty.
  expected : url
  Fix: Add DATABASE_URL=https://example.com to your .env file.

[MISSING] JWT_SECRET: Required variable "JWT_SECRET" is missing or empty.
  expected : string
  Fix: Add JWT_SECRET=<your-string-value> to your .env file.
```

## Features

### Type Validation

Supported types: `string`, `number`, `boolean`, `url`.

```js
{
  PORT:     { type: "number", default: 3000 },
  DEBUG:    { type: "boolean", default: false },  // accepts true/false/1/0/yes/no
  API_URL:  { type: "url", required: true },      // validated with WHATWG URL
  APP_NAME: { type: "string", default: "myapp" },
}
```

### .env File Loading

EnvPilot automatically loads `.env` files by environment:

```
.env                  ← always loaded
.env.development      ← loaded when NODE_ENV=development
.env.local            ← local overrides (gitignored)
.env.development.local
```

Real environment variables always override file values. Files never mutate `process.env`.

Disable with `envFile: false`:

```js
createConfig(schema, { envFile: false });
```

### Nested Config

Group related variables with nested schemas:

```js
const schema = {
  DATABASE: {
    HOST: { type: "string", default: "localhost" },
    PORT: { type: "number", default: 5432 },
    NAME: { type: "string", required: true },
  },
  REDIS: {
    URL: { type: "url", required: true },
  },
};

const config = createConfig(schema);
// Reads DATABASE_HOST, DATABASE_PORT, DATABASE_NAME, REDIS_URL
// Returns: config.DATABASE.HOST, config.DATABASE.PORT, ...
```

### Custom Validators

```js
{
  PORT: {
    type: "number",
    validate: (value) => value > 0 && value < 65536 || "Port must be 1–65535",
  },
  API_URL: {
    type: "url",
    validate: (value, { environment }) => {
      if (environment === "production" && value.includes("localhost")) {
        return "Production API must not use localhost";
      }
      return true;
    },
  },
}
```

### Secret Masking

Variables are automatically detected as secrets by naming convention (`_SECRET`, `_KEY`, `_TOKEN`, `_PASSWORD`, `_PASSWD`, `PRIVATE_KEY`). Secret values are **never** shown in error messages, logs, JSON output, or CLI output.

```js
{ JWT_SECRET: { type: "string", required: true } }
// Automatically masked — received shows "[hidden]"

{ MY_VALUE: { type: "string", secret: true } }
// Explicitly mark as secret

{ API_KEY: { type: "string", secret: false } }
// Opt out of auto-detection
```

## Smart Configuration Doctor

The doctor checks for **warnings** — problems that don't block startup but should be fixed:

| Code                      | What it catches                                 |
| ------------------------- | ----------------------------------------------- |
| `WEAK_SECRET`             | Secret value shorter than 16 characters         |
| `DEBUG_IN_PRODUCTION`     | Debug mode enabled in production                |
| `LOCALHOST_IN_PRODUCTION` | URL pointing to localhost in production         |
| `DEFAULT_IN_PRODUCTION`   | Variable fell back to its default in production |

Use `createConfigWithReport` to get warnings without throwing:

```js
import { createConfigWithReport } from "envpilot";

const { config, issues, warnings, environment } = await createConfigWithReport(schema);

if (issues.length > 0) {
  console.error("Validation failed:", issues);
}
for (const w of warnings) {
  console.warn(`[${w.code}] ${w.key}: ${w.message}`);
}
```

## CLI

```bash
npx envpilot check
```

The CLI loads your schema from `envpilot.config.js` (or `.mjs`) and validates the environment.

### Options

| Flag              | Description                                        |
| ----------------- | -------------------------------------------------- |
| `--env <name>`    | Override environment (development/test/production) |
| `--cwd <dir>`     | Working directory (default: `.`)                   |
| `--config <path>` | Path to config file                                |
| `--json`          | Output JSON (secrets always masked)                |
| `--no-color`      | Disable colours                                    |
| `--strict`        | Treat warnings as failures (exit 1)                |
| `--help`          | Show help                                          |
| `--version`       | Show version                                       |

### Exit Codes

| Code | Meaning                                         |
| ---- | ----------------------------------------------- |
| `0`  | All valid                                       |
| `1`  | Validation errors (or warnings with `--strict`) |
| `2`  | Usage or config-loading error                   |

### Example Output

```
EnvPilot Report (production)

── Errors (1) ──

✖ DATABASE_URL
  Problem: Required variable "DATABASE_URL" is missing or empty.
  Why:     The application cannot start without "DATABASE_URL".
  Expected: url
  Fix:     Add DATABASE_URL=https://example.com to your .env file.

── Warnings (1) ──

⚠ PORT
  Warning: "PORT" is using its default value in production.
  Fix:     Explicitly set PORT in your production environment.

1 error, 1 warning
```

### JSON Output

```bash
npx envpilot check --json
```

```json
{
  "ok": false,
  "environment": "production",
  "issues": [
    {
      "key": "DATABASE_URL",
      "code": "MISSING",
      "message": "Required variable \"DATABASE_URL\" is missing or empty.",
      "expected": "url",
      "why": "The application cannot start without \"DATABASE_URL\".",
      "fix": "Add DATABASE_URL=https://example.com to your .env file."
    }
  ],
  "warnings": []
}
```

## API Reference

### `createConfig(schema, options?)`

Validates environment variables and returns a frozen config object. Throws a single `EnvPilotError` listing all issues.

### `createConfigWithReport(schema, options?)`

Like `createConfig` but never throws. Returns `{ config, issues, warnings, environment }`.

### `parseEnv(text)`

Parse `.env` file content into a plain object.

### `loadEnvFile(path)`

Read and parse a `.env` file. Returns `{}` if the file doesn't exist.

### `detectEnvironment(env?)`

Detect the environment from `NODE_ENV`. Returns `"development"`, `"test"`, or `"production"`.

### `formatReport({ issues, warnings, environment }, options?)`

Format issues and warnings into a human-readable report string.

### Options

| Option        | Default         | Description                     |
| ------------- | --------------- | ------------------------------- |
| `env`         | `process.env`   | Environment object to read from |
| `envFile`     | `true`          | Load `.env` files               |
| `cwd`         | `process.cwd()` | Directory for `.env` files      |
| `environment` | auto-detect     | Override environment            |

## Coming Soon

- **Config merging** — merge multiple schemas or partial configs.
- **Environment profiles** — named presets per environment.

## License

MIT
