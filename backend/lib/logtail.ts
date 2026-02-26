import { Logtail } from "@logtail/node";

let instance: Logtail | NoopLogtail | FlushLogtail | null = null;

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

function wrapWithFlush(client: Logtail): FlushLogtail {
  return {
    info: (message, context) =>
      client.info(message, context).then((r) => client.flush().then(() => r)),
    warn: (message, context) =>
      client.warn(message, context).then((r) => client.flush().then(() => r)),
    error: (message, context) =>
      client.error(message, context).then((r) => client.flush().then(() => r)),
    debug: (message, context) =>
      client.debug(message, context).then((r) => client.flush().then(() => r)),
  };
}

interface NoopLogtail {
  info(message: string, context?: Context): Promise<unknown>;
  warn(message: string, context?: Context): Promise<unknown>;
  error(message: string, context?: Context): Promise<unknown>;
  debug(message: string, context?: Context): Promise<unknown>;
}

interface FlushLogtail extends NoopLogtail {}

export function getLogtail(): NoopLogtail | FlushLogtail {
  if (instance) return instance;
  const token = process.env.LOGTAIL_SOURCE_TOKEN;
  const endpoint = process.env.LOGTAIL_ENDPOINT?.replace(/^"|"$/g, "")?.trim();
  if (!token) {
    instance = createNoopLogger();
    return instance;
  }
  const client = new Logtail(token, endpoint ? { endpoint } : undefined);
  instance = wrapWithFlush(client);
  return instance;
}
