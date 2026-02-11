/**
 * Logger utility for frontend logging.
 * Sends logs to Logtail (Better Stack) while preserving console output for local development.
 */

import { Logtail } from "@logtail/browser";

// Initialize Logtail client if token is configured
const logtailToken = import.meta.env.VITE_LOGTAIL_SOURCE_TOKEN;
const logtailEndpoint = import.meta.env.VITE_LOGTAIL_ENDPOINT;

const logtail =
  logtailToken && typeof logtailToken === "string" && logtailToken.trim() !== ""
    ? new Logtail(logtailToken, {
        endpoint: logtailEndpoint,
      })
    : null;

/**
 * Log levels for structured logging
 */
export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

/**
 * Logger interface matching console methods
 */
interface Logger {
  debug: (...args: unknown[]) => void;
  log: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

/**
 * Logs a message to both console and Logtail (if configured)
 */
async function logToLogtail(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>
): Promise<void> {
  if (!logtail) {
    return;
  }

  try {
    await logtail.log(message, level, context);
    await logtail.flush();
  } catch (err) {
    // Silently fail if Logtail is unavailable
    // Don't break the app if logging fails
    console.warn("[Logger] Failed to send log to Logtail:", err);
  }
}

/**
 * Format arguments into a message string
 */
function formatMessage(...args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === "string") {
        return arg;
      }
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(" ");
}

/**
 * Extract context from log arguments (objects, errors, etc.)
 */
function extractContext(...args: unknown[]): Record<string, unknown> {
  const context: Record<string, unknown> = {};

  args.forEach((arg, index) => {
    if (arg instanceof Error) {
      context[`error_${index}`] = {
        message: arg.message,
        stack: arg.stack,
        name: arg.name,
      };
    } else if (typeof arg === "object" && arg !== null) {
      context[`data_${index}`] = arg;
    }
  });

  return context;
}

/**
 * Logger implementation that logs to both console and Logtail
 */
const logger: Logger = {
  debug: (...args: unknown[]) => {
    const message = formatMessage(...args);
    console.debug(...args);
    logToLogtail(LogLevel.DEBUG, message, extractContext(...args));
  },

  log: (...args: unknown[]) => {
    const message = formatMessage(...args);
    console.log(...args);
    logToLogtail(LogLevel.INFO, message, extractContext(...args));
  },

  info: (...args: unknown[]) => {
    const message = formatMessage(...args);
    console.info(...args);
    logToLogtail(LogLevel.INFO, message, extractContext(...args));
  },

  warn: (...args: unknown[]) => {
    const message = formatMessage(...args);
    console.warn(...args);
    logToLogtail(LogLevel.WARN, message, extractContext(...args));
  },

  error: (...args: unknown[]) => {
    const message = formatMessage(...args);
    console.error(...args);
    logToLogtail(LogLevel.ERROR, message, extractContext(...args));
  },
};

/**
 * Set additional context/metadata for all subsequent logs
 */
export function setContext(context: Record<string, unknown>): void {
  if (logtail) {
    logtail.setContext(context);
  }
}

/**
 * Flush pending logs (useful before app closes or page unload)
 */
export async function flush(): Promise<void> {
  if (logtail) {
    await logtail.flush();
  }
}

export default logger;
