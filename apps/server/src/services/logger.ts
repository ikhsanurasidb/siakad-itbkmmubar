import type { ServerLogger } from "@siakad-itbkmmubar/api/context";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFormat = "pretty" | "json";

const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  debug: 10,
  error: 40,
  info: 20,
  warn: 30,
};

const SENSITIVE_KEY_PARTS = [
  "authorization",
  "cookie",
  "password",
  "secret",
  "session",
  "token",
  "csrf",
  "file",
  "blob",
  "body",
  "latitude",
  "longitude",
  "coordinates",
] as const;

const REDACTED = "[REDACTED]";

export interface LogTransport {
  debug: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warn: (message: string) => void;
}

export interface LoggerOptions {
  format?: LogFormat;
  level?: LogLevel;
  now?: () => Date;
  transport?: LogTransport;
  baseContext?: Record<string, unknown>;
}

const isSensitiveKey = (key: string): boolean => {
  const normalizedKey = key.toLowerCase().replaceAll("_", "");
  return SENSITIVE_KEY_PARTS.some((part) => normalizedKey.includes(part));
};

const redactValue = (value: unknown, seen: WeakSet<object>): unknown => {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Error) {
    return {
      cause:
        value.cause === undefined ? undefined : redactValue(value.cause, seen),
      message: value.message,
      name: value.name,
      stack: value.stack,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, seen));
  }

  if (value && typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }

    seen.add(value);
    const result: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      result[key] = isSensitiveKey(key)
        ? REDACTED
        : redactValue(nestedValue, seen);
    }
    seen.delete(value);
    return result;
  }

  return value;
};

export const redactSensitive = (value: unknown): unknown =>
  redactValue(value, new WeakSet<object>());

export const maskIdentifier = (identifier: string): string => {
  if (identifier.length <= 4) {
    return "***";
  }

  return `${identifier.slice(0, 2)}***${identifier.slice(-2)}`;
};

export const serializeError = (
  error: unknown,
  seen = new WeakSet<object>()
): Record<string, unknown> => {
  if (error instanceof Error) {
    const serialized: Record<string, unknown> = {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };

    if (error.cause !== undefined) {
      serialized.cause = redactValue(error.cause, seen);
    }

    return serialized;
  }

  return { thrown: redactValue(error, seen) };
};

const getDefaultLevel = (): LogLevel =>
  typeof process !== "undefined" && process.env.NODE_ENV === "production"
    ? "info"
    : "debug";

const getDefaultFormat = (): LogFormat =>
  typeof process !== "undefined" && process.env.NODE_ENV === "production"
    ? "json"
    : "pretty";

const createMessage = (
  level: LogLevel,
  event: string,
  context: Record<string, unknown>,
  format: LogFormat,
  now: () => Date
): string => {
  const payload = {
    ...context,
    event,
    level,
    timestamp: now().toISOString(),
  };
  const safePayload = redactSensitive(payload) as Record<string, unknown>;

  if (format === "json") {
    return JSON.stringify(safePayload);
  }

  const {
    event: safeEvent,
    level: safeLevel,
    timestamp,
    ...details
  } = safePayload;
  const suffix = Object.keys(details).length
    ? ` ${JSON.stringify(details)}`
    : "";
  return `[${timestamp}] ${String(safeLevel).toUpperCase()} ${safeEvent}${suffix}`;
};

export const createServerLogger = (
  options: LoggerOptions = {},
  inheritedContext: Record<string, unknown> = {}
): ServerLogger => {
  const level = options.level ?? getDefaultLevel();
  const format = options.format ?? getDefaultFormat();
  const now = options.now ?? (() => new Date());
  const transport = options.transport ?? console;
  const baseContext = { ...options.baseContext, ...inheritedContext };

  const write = (
    logLevel: LogLevel,
    event: string,
    context: Record<string, unknown>,
    error?: unknown
  ): void => {
    if (LOG_LEVEL_VALUES[logLevel] < LOG_LEVEL_VALUES[level]) {
      return;
    }

    const message = createMessage(
      logLevel,
      event,
      {
        ...baseContext,
        ...context,
        ...(error === undefined ? {} : { error: serializeError(error) }),
      },
      format,
      now
    );
    transport[logLevel](message);
  };

  return {
    child(context) {
      return createServerLogger(options, { ...baseContext, ...context });
    },
    debug(event, context = {}) {
      write("debug", event, context);
    },
    error(event, error, context = {}) {
      write("error", event, context, error);
    },
    info(event, context = {}) {
      write("info", event, context);
    },
    warn(event, context = {}) {
      write("warn", event, context);
    },
  };
};
