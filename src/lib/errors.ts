/** 业务层可预期错误：携带 HTTP 状态码，由 API 层统一转为 JSON 响应 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 400, code = "BAD_REQUEST") {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

export function toPublicError(err: unknown): { message: string; status: number; code: string } {
  if (err instanceof AppError) {
    return { message: err.message, status: err.status, code: err.code };
  }
  return {
    message: err instanceof Error ? err.message : "服务器内部错误",
    status: 500,
    code: "INTERNAL_ERROR",
  };
}
