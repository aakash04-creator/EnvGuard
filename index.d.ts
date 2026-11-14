/**
 * TypeScript declarations for envpilot.
 */

export type FieldType = "string" | "number" | "boolean" | "url";

export type Environment = "development" | "test" | "production";

export interface ValidationContext {
  key: string;
  env: Record<string, string | undefined>;
  environment: Environment;
}

export type CustomValidator<T = unknown> = (
  value: T,
  ctx: ValidationContext,
) => boolean | string | void | undefined;

export interface ProfileSpec<T = unknown> {
  type?: FieldType;
  required?: boolean;
  default?: T;
  secret?: boolean;
  description?: string;
  validate?: CustomValidator<T>;
}

export interface Profiles<T = unknown> {
  development?: ProfileSpec<T>;
  test?: ProfileSpec<T>;
  production?: ProfileSpec<T>;
  [key: string]: ProfileSpec<T> | undefined;
}

export interface FieldSchema<T = unknown> {
  type: FieldType;
  required?: boolean;
  default?: T;
  secret?: boolean;
  description?: string;
  validate?: CustomValidator<T>;
  profiles?: Profiles<T>;
}

export type SchemaNode = FieldSchema<any> | { [key: string]: SchemaNode };

export type Schema = Record<string, SchemaNode>;

export type InferredType<T extends FieldType> = T extends "number"
  ? number
  : T extends "boolean"
    ? boolean
    : T extends "url" | "string"
      ? string
      : unknown;

export type InferredField<F> = F extends { type: infer T extends FieldType }
  ? F extends { required: true } | { default: any }
    ? InferredType<T>
    : InferredType<T> | undefined
  : F extends Record<string, any>
    ? InferredConfig<F>
    : unknown;

export type InferredConfig<S> = {
  readonly [K in keyof S]: InferredField<S[K]>;
};

export interface CreateConfigOptions {
  env?: Record<string, string | undefined>;
  envFile?: boolean;
  cwd?: string;
  environment?: Environment | string;
}

export type IssueCode =
  | "MISSING"
  | "INVALID_TYPE"
  | "INVALID_SCHEMA"
  | "CUSTOM_VALIDATION";

export class ValidationIssue {
  readonly key: string;
  readonly code: IssueCode;
  readonly message: string;
  readonly expected?: string;
  readonly received?: string;
  readonly why?: string;
  readonly fix?: string;

  constructor(opts: {
    key: string;
    code: IssueCode;
    message: string;
    expected?: string;
    received?: string;
    why?: string;
    fix?: string;
  });

  toString(): string;
}

export class EnvPilotError extends Error {
  readonly name: "EnvPilotError";
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]);
}

export interface Warning {
  key: string;
  code:
    | "WEAK_SECRET"
    | "DEBUG_IN_PRODUCTION"
    | "LOCALHOST_IN_PRODUCTION"
    | "DEFAULT_IN_PRODUCTION"
    | string;
  message: string;
  fix: string;
}

export interface ReportResult<T = Record<string, unknown>> {
  config: T | null;
  issues: ValidationIssue[];
  warnings: Warning[];
  environment: Environment;
}

/**
 * Validates environment variables against a schema and returns a frozen config object.
 * Throws a single EnvPilotError listing all issues.
 */
export function createConfig<S extends Schema>(
  schema: S,
  options?: CreateConfigOptions,
): InferredConfig<S>;

/**
 * Validates environment variables against a schema without throwing.
 * Returns config, issues, doctor warnings, and detected environment.
 */
export function createConfigWithReport<S extends Schema>(
  schema: S,
  options?: CreateConfigOptions,
): Promise<ReportResult<InferredConfig<S>>>;

/**
 * Parse the text content of a .env file into a key-value object.
 */
export function parseEnv(text: string): Record<string, string>;

/**
 * Read and parse a .env file synchronously. Returns {} if file does not exist.
 */
export function loadEnvFile(filePath: string): Record<string, string>;

/**
 * Detect runtime environment from NODE_ENV. Defaults to "development".
 */
export function detectEnvironment(
  env?: Record<string, string | undefined>,
): Environment;

/**
 * Format validation issues and doctor warnings into a human-readable report string.
 */
export function formatReport(
  data: {
    issues: ValidationIssue[];
    warnings: Warning[];
    environment: string;
  },
  options?: { color?: boolean },
): string;

/**
 * Merge multiple schemas into a new schema without mutating inputs.
 */
export function mergeSchemas<T extends Schema[]>(...schemas: T): Schema;

/**
 * Identity helper that validates schema structure early and returns the schema.
 */
export function defineSchema<T extends Schema>(schema: T): T;

/**
 * Generate a documented .env.example template string from a schema.
 */
export function generateExample(
  schema: Schema,
  options?: { includeDefaults?: boolean },
): string;

/**
 * Return masked value placeholder "[hidden]".
 */
export function maskValue(): string;

/**
 * Check if variable name matches secret naming conventions.
 */
export function isSecretKey(name: string): boolean;

/**
 * Check if a variable should be treated as secret given its name and schema.
 */
export function isSecret(name: string, spec: { secret?: boolean }): boolean;

/**
 * Redact sensitive values from a string, replacing them with "[hidden]".
 */
export function redact(text: string, secretValues: string[]): string;

/**
 * Run doctor checks to flag potential production configuration issues.
 */
export function doctor(opts: {
  config: Record<string, unknown>;
  schema: Schema;
  fields: Array<{ envKey: string; path: string[]; spec: any }>;
  env: Record<string, string | undefined>;
  environment: string;
}): Warning[];
