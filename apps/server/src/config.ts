export type RuntimeEnvironment = "development" | "test" | "production";

export interface TlsConfig {
  readonly certPath: string;
  readonly keyPath: string;
}

export interface ServerConfig {
  readonly environment: RuntimeEnvironment;
  readonly host: string;
  readonly port: number;
  readonly allowedOrigins: ReadonlySet<string>;
  readonly allowAnyDevelopmentOrigin: boolean;
  readonly tls: TlsConfig | null;
  readonly publicServerUrl: string | null;
  readonly maxConnections: number;
  readonly maxMessageBytes: number;
  readonly maxHttpBodyBytes: number;
  readonly maxMessagesPerSecond: number;
  readonly pingIntervalMs: number;
  readonly pingMaxRetries: number;
  readonly shutdownTimeoutMs: number;
  readonly logLevel: "debug" | "info" | "warn" | "error";
}

const DEFAULTS = {
  host: "0.0.0.0",
  port: 2567,
  maxConnections: 1_000,
  maxMessageBytes: 16 * 1024,
  maxHttpBodyBytes: 64 * 1024,
  maxMessagesPerSecond: 180,
  pingIntervalMs: 5_000,
  pingMaxRetries: 3,
  shutdownTimeoutMs: 10_000,
} as const;

export function loadServerConfig(environment: NodeJS.ProcessEnv = process.env): ServerConfig {
  const runtime = parseEnvironment(environment.NODE_ENV);
  const allowedOrigins = parseAllowedOrigins(environment.ALLOWED_ORIGINS);
  const allowAnyDevelopmentOrigin =
    runtime !== "production" && parseBoolean(environment.DEV_ALLOW_ANY_ORIGIN, true);

  if (runtime === "production" && allowedOrigins.size === 0) {
    throw new Error(
      "ALLOWED_ORIGINS must contain at least one HTTPS frontend origin in production.",
    );
  }
  if (runtime === "production" && [...allowedOrigins].some((origin) => origin === "*")) {
    throw new Error("ALLOWED_ORIGINS cannot contain '*' in production.");
  }
  if (
    runtime === "production" &&
    [...allowedOrigins].some((origin) => origin !== "*" && !origin.startsWith("https://"))
  ) {
    throw new Error("Production ALLOWED_ORIGINS entries must use https://.");
  }

  const certPath = environment.TLS_CERT_PATH?.trim();
  const keyPath = environment.TLS_KEY_PATH?.trim();
  if (Boolean(certPath) !== Boolean(keyPath)) {
    throw new Error("TLS_CERT_PATH and TLS_KEY_PATH must be configured together.");
  }

  const publicServerUrl = parseOptionalUrl(environment.PUBLIC_SERVER_URL, "PUBLIC_SERVER_URL");
  if (runtime === "production" && publicServerUrl && !publicServerUrl.startsWith("https://")) {
    throw new Error("PUBLIC_SERVER_URL must use https:// in production.");
  }

  return {
    environment: runtime,
    host: environment.HOST?.trim() || DEFAULTS.host,
    port: parseInteger(environment.PORT, DEFAULTS.port, 1, 65_535, "PORT"),
    allowedOrigins,
    allowAnyDevelopmentOrigin,
    tls: certPath && keyPath ? { certPath, keyPath } : null,
    publicServerUrl,
    maxConnections: parseInteger(
      environment.MAX_CONNECTIONS,
      DEFAULTS.maxConnections,
      2,
      100_000,
      "MAX_CONNECTIONS",
    ),
    maxMessageBytes: parseInteger(
      environment.MAX_MESSAGE_BYTES,
      DEFAULTS.maxMessageBytes,
      1_024,
      1_048_576,
      "MAX_MESSAGE_BYTES",
    ),
    maxHttpBodyBytes: parseInteger(
      environment.MAX_HTTP_BODY_BYTES,
      DEFAULTS.maxHttpBodyBytes,
      4_096,
      1_048_576,
      "MAX_HTTP_BODY_BYTES",
    ),
    maxMessagesPerSecond: parseInteger(
      environment.MAX_MESSAGES_PER_SECOND,
      DEFAULTS.maxMessagesPerSecond,
      30,
      2_000,
      "MAX_MESSAGES_PER_SECOND",
    ),
    pingIntervalMs: parseInteger(
      environment.PING_INTERVAL_MS,
      DEFAULTS.pingIntervalMs,
      1_000,
      60_000,
      "PING_INTERVAL_MS",
    ),
    pingMaxRetries: parseInteger(
      environment.PING_MAX_RETRIES,
      DEFAULTS.pingMaxRetries,
      1,
      20,
      "PING_MAX_RETRIES",
    ),
    shutdownTimeoutMs: parseInteger(
      environment.SHUTDOWN_TIMEOUT_MS,
      DEFAULTS.shutdownTimeoutMs,
      1_000,
      60_000,
      "SHUTDOWN_TIMEOUT_MS",
    ),
    logLevel: parseLogLevel(environment.LOG_LEVEL),
  };
}

export function isOriginAllowed(config: ServerConfig, origin: string | null | undefined): boolean {
  if (!origin) return true;
  if (config.allowAnyDevelopmentOrigin) return true;
  return config.allowedOrigins.has(normalizeOrigin(origin));
}

function parseEnvironment(value: string | undefined): RuntimeEnvironment {
  if (value === "production" || value === "test") return value;
  return "development";
}

function parseAllowedOrigins(value: string | undefined): ReadonlySet<string> {
  const origins = new Set<string>();
  for (const rawOrigin of value?.split(",") ?? []) {
    const origin = rawOrigin.trim();
    if (!origin) continue;
    origins.add(origin === "*" ? origin : normalizeOrigin(origin));
  }
  return origins;
}

function normalizeOrigin(origin: string): string {
  try {
    return new URL(origin).origin;
  } catch {
    throw new Error(`Invalid origin in ALLOWED_ORIGINS: ${origin}`);
  }
}

function parseOptionalUrl(value: string | undefined, name: string): string | null {
  if (!value?.trim()) return null;
  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    throw new Error(`${name} must be an absolute HTTP(S) URL.`);
  }
}

function parseInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  name: string,
): number {
  if (!value?.trim()) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (
    !Number.isInteger(parsed) ||
    String(parsed) !== value.trim() ||
    parsed < minimum ||
    parsed > maximum
  ) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return parsed;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value?.trim()) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error("Boolean environment variables must be 'true' or 'false'.");
}

function parseLogLevel(value: string | undefined): ServerConfig["logLevel"] {
  if (!value?.trim()) return "info";
  if (value === "debug" || value === "info" || value === "warn" || value === "error") return value;
  throw new Error("LOG_LEVEL must be debug, info, warn, or error.");
}
