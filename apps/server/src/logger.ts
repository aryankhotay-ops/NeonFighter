import type { ServerConfig } from "./config";

export type LogLevel = ServerConfig["logLevel"];
export type LogDetails = Readonly<Record<string, unknown>>;

const PRIORITY: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

let minimumLevel: LogLevel = "info";

export function configureLogger(level: LogLevel): void {
  minimumLevel = level;
}

export function logDebug(event: string, details: LogDetails = {}): void {
  write("debug", event, details);
}

export function logInfo(event: string, details: LogDetails = {}): void {
  write("info", event, details);
}

export function logWarn(event: string, details: LogDetails = {}): void {
  write("warn", event, details);
}

export function logError(event: string, error: unknown, details: LogDetails = {}): void {
  write("error", event, {
    ...details,
    error:
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : String(error),
  });
}

export function createFrameworkLogger() {
  return {
    debug: (...args: unknown[]) => logDebug("colyseus.debug", { args }),
    trace: (...args: unknown[]) => logDebug("colyseus.trace", { args }),
    info: (...args: unknown[]) => logInfo("colyseus.info", { args }),
    warn: (...args: unknown[]) => logWarn("colyseus.warn", { args }),
    error: (...args: unknown[]) => logError("colyseus.error", args[0], { args: args.slice(1) }),
  };
}

function write(level: LogLevel, event: string, details: LogDetails): void {
  if (PRIORITY[level] < PRIORITY[minimumLevel]) return;
  const record = safeStringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...details,
  });
  if (level === "error") console.error(record);
  else if (level === "warn") console.warn(record);
  else console.log(record);
}

function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (key, nestedValue: unknown) => {
    if (/token|authorization|cookie|password|secret/i.test(key)) return "[REDACTED]";
    if (typeof nestedValue === "bigint") return nestedValue.toString();
    if (nestedValue instanceof Error) {
      return { name: nestedValue.name, message: nestedValue.message, stack: nestedValue.stack };
    }
    if (nestedValue && typeof nestedValue === "object") {
      if (seen.has(nestedValue)) return "[Circular]";
      seen.add(nestedValue);
    }
    return nestedValue;
  });
}
