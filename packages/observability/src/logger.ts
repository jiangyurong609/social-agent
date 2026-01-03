export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug: (msg: string, meta?: Record<string, unknown>) => void;
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
}

function log(level: LogLevel, msg: string, meta?: Record<string, unknown>) {
  const payload = meta ? `${msg} ${JSON.stringify(meta)}` : msg;
  switch (level) {
    case "debug":
    case "info":
      console.log(payload);
      break;
    case "warn":
      console.warn(payload);
      break;
    case "error":
      console.error(payload);
      break;
  }
}

export function createLogger(namespace: string): Logger {
  const prefix = `[${namespace}]`;
  return {
    debug: (msg, meta) => log("debug", `${prefix} ${msg}`, meta),
    info: (msg, meta) => log("info", `${prefix} ${msg}`, meta),
    warn: (msg, meta) => log("warn", `${prefix} ${msg}`, meta),
    error: (msg, meta) => log("error", `${prefix} ${msg}`, meta)
  };
}
