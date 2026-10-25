type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, scope: string, message: string, meta?: unknown) {
  const line = `[AnythingBox][${scope}] ${message}`;
  const args: unknown[] = meta === undefined ? [line] : [line, meta];
  switch (level) {
    case "warn":
      console.warn(...args);
      break;
    case "error":
      console.error(...args);
      break;
    case "debug":
      if (process.env.NODE_ENV !== "production") console.debug(...args);
      break;
    default:
      console.log(...args);
  }
}

/** 轻量结构化日志：按模块划分作用域，避免引入额外依赖 */
export function createLogger(scope: string) {
  return {
    debug: (msg: string, meta?: unknown) => emit("debug", scope, msg, meta),
    info: (msg: string, meta?: unknown) => emit("info", scope, msg, meta),
    warn: (msg: string, meta?: unknown) => emit("warn", scope, msg, meta),
    error: (msg: string, meta?: unknown) => emit("error", scope, msg, meta),
  };
}
