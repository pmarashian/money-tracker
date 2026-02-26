import { Logtail } from "@logtail/node";

let instance: Logtail | NoopLogtail | null = null;

type Context = Record<string, unknown>;

function noop(_message: string, _context?: Context): Promise<unknown> {
  return Promise.resolve({});
}

function createNoopLogger(): NoopLogtail {
  return {
    info: noop,
    warn: noop,
    error: noop,
    debug: noop,
  };
}

interface NoopLogtail {
  info(message: string, context?: Context): Promise<unknown>;
  warn(message: string, context?: Context): Promise<unknown>;
  error(message: string, context?: Context): Promise<unknown>;
  debug(message: string, context?: Context): Promise<unknown>;
}

export function getLogtail(): Logtail | NoopLogtail {
  if (instance) return instance;
  const token = process.env.LOGTAIL_SOURCE_TOKEN;
  const endpoint = process.env.LOGTAIL_ENDPOINT?.replace(/^"|"$/g, "")?.trim();
  if (!token) {
    instance = createNoopLogger();
    return instance;
  }
  instance = new Logtail(token, endpoint ? { endpoint } : undefined);
  return instance;
}
