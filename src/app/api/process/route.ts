import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AppError, toPublicError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { runTask } from "@/lib/engine";
import type { AiAction, Operation } from "@/lib/operations";
import type { TargetFormat } from "@/lib/types";

const log = createLogger("api:process");

export const runtime = "nodejs";
// AI / OCR 处理可能较慢
export const maxDuration = 300;

const BodySchema = z.object({
  op: z.enum(["extract-text", "ocr", "convert", "ai"]),
  /** op = convert 时必填 */
  target: z.enum(["txt", "md", "html", "docx", "pdf", "json", "csv"]).optional(),
  /** op = ai 时必填 */
  action: z.enum(["summarize", "keypoints", "ask"]).optional(),
  /** action = ask 时必填 */
  question: z.string().trim().min(1).max(2000).optional(),
  fileIds: z.array(z.string().min(1)).min(1, "请至少选择一个文件").max(50, "单次任务最多处理 50 个文件"),
});

/** 解析并校验请求体，得到规范化的操作描述 */
function parseBody(raw: unknown): { op: Operation; fileIds: string[]; question?: string } {
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new AppError(
      first ? `${first.path.join(".") || "请求体"}：${first.message}` : "请求体校验失败",
      400,
      "INVALID_BODY",
    );
  }
  const { op, target, action, question, fileIds } = parsed.data;
  if (op === "convert" && !target) {
    throw new AppError("转换操作需要指定目标格式 target", 400, "TARGET_REQUIRED");
  }
  if (op === "ai" && !action) {
    throw new AppError("AI 操作需要指定 action", 400, "ACTION_REQUIRED");
  }
  if (op === "ai" && action === "ask" && !question) {
    throw new AppError("文档问答需要提供问题 question", 400, "QUESTION_REQUIRED");
  }
  switch (op) {
    case "extract-text":
      return { op: { op: "extract-text" }, fileIds };
    case "ocr":
      return { op: { op: "ocr" }, fileIds };
    case "convert":
      return { op: { op: "convert", target: target as TargetFormat }, fileIds };
    case "ai":
      return { op: { op: "ai", action: action as AiAction, question }, fileIds, question };
  }
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json().catch(() => {
      throw new AppError("请求体不是有效的 JSON", 400, "INVALID_JSON");
    });
    const { op, fileIds, question } = parseBody(raw);
    log.info("开始处理任务", { op: op.op, files: fileIds.length });
    const task = await runTask({ op, fileIds, question });
    log.info("任务完成", { taskId: task.id, status: task.status });
    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    const { message, status, code } = toPublicError(err);
    log.error("任务失败", { message, code });
    return NextResponse.json({ error: message, code }, { status });
  }
}
