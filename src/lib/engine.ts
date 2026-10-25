import { randomUUID } from "node:crypto";
import { AppError } from "./errors";
import { extractTextFromFile } from "./extract";
import { convertFile } from "./convert";
import { ocrImage } from "./ocr";
import { callAi } from "./ai";
import { fileStore, readUpload, resultStore, taskStore, writeResult, readResult } from "./storage";
import { RESULT_MIME } from "./convert";
import { KIND_LABEL } from "./file-utils";
import { TEXT_EXTRACTABLE_KINDS, type Operation } from "./operations";
import type { AiOutput, ResultFile, TaskError, TaskRecord } from "./types";

export interface CreateTaskInput {
  op: Operation;
  fileIds: string[];
  question?: string;
}

interface ItemResult {
  fileId: string;
  name: string;
  resultId?: string;
  error?: string;
}

function resultName(originalStem: string, suffix: string, ext: string): string {
  return `${originalStem} - ${suffix}.${ext}`;
}

function stemOf(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx > 0 ? name.slice(0, idx) : name;
}

async function saveResult(
  taskId: string,
  sourceFileId: string,
  name: string,
  mimeType: string,
  data: Buffer,
): Promise<ResultFile> {
  const record: ResultFile = {
    id: randomUUID(),
    taskId,
    sourceFileId,
    name,
    mimeType,
    size: data.byteLength,
    storedName: `${randomUUID()}.${name.split(".").pop() ?? "bin"}`,
    createdAt: new Date().toISOString(),
  };
  await writeResult(record.storedName, data);
  return resultStore.insert(record);
}

async function runOnFile(
  taskId: string,
  op: Operation,
  fileId: string,
): Promise<Omit<ItemResult, "error"> & Partial<Pick<ItemResult, "error">>> {
  const file = await fileStore.get(fileId);
  if (!file) throw new AppError("文件不存在或已被删除", 404, "FILE_NOT_FOUND");
  const buffer = await readUpload(file.storedName);
  const stem = stemOf(file.originalName);

  switch (op.op) {
    case "extract-text": {
      if (!TEXT_EXTRACTABLE_KINDS.includes(file.kind)) {
        throw new AppError(
          file.kind === "image"
            ? "图片请使用“OCR 文字识别”"
            : `不支持的文件类型：${KIND_LABEL[file.kind]}`,
          400,
          "UNSUPPORTED",
        );
      }
      const { text } = await extractTextFromFile(buffer, file.kind, file.originalName);
      if (!text.trim()) {
        throw new AppError("未能提取到文本内容（文件可能是空的或仅包含图片）", 422, "EMPTY_TEXT");
      }
      const r = await saveResult(
        taskId,
        fileId,
        resultName(stem, "提取文本", "txt"),
        RESULT_MIME.txt,
        Buffer.from(text, "utf8"),
      );
      return { fileId, name: file.originalName, resultId: r.id };
    }

    case "ocr": {
      if (file.kind !== "image") {
        throw new AppError("OCR 仅支持图片文件（PNG / JPG / WEBP / BMP / TIFF）", 400, "UNSUPPORTED");
      }
      const text = await ocrImage(buffer, file.originalName);
      const r = await saveResult(
        taskId,
        fileId,
        resultName(stem, "OCR 文字", "txt"),
        RESULT_MIME.txt,
        Buffer.from(text, "utf8"),
      );
      return { fileId, name: file.originalName, resultId: r.id };
    }

    case "convert": {
      const out = await convertFile(file.kind, op.target, buffer, file.originalName);
      const target = op.target;
      const r = await saveResult(
        taskId,
        fileId,
        resultName(stem, `转换为${target.toUpperCase()}`, out.ext),
        out.mimeType,
        out.data,
      );
      return { fileId, name: file.originalName, resultId: r.id };
    }

    case "ai": {
      if (!TEXT_EXTRACTABLE_KINDS.includes(file.kind) && file.kind !== "image") {
        throw new AppError(`不支持的文件类型：${KIND_LABEL[file.kind]}`, 400, "UNSUPPORTED");
      }
      let text: string;
      if (file.kind === "image") {
        text = await ocrImage(buffer, file.originalName);
      } else {
        const extracted = await extractTextFromFile(buffer, file.kind, file.originalName);
        text = extracted.text;
      }
      if (!text.trim()) {
        throw new AppError("未能从文件中提取到文本，无法进行 AI 分析", 422, "EMPTY_TEXT");
      }
      // 超长文档截断，避免超出模型上下文
      const MAX_CHARS = 60_000;
      const clipped = text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}\n\n[文档过长，已截断]` : text;
      const { output } = await callAi({
        action: op.action,
        question: op.question,
        documentTitle: file.originalName,
        documentText: clipped,
      });
      const r = await saveResult(
        taskId,
        fileId,
        resultName(stem, `AI ${opLabelOf(op)}`, "md"),
        RESULT_MIME.md,
        Buffer.from(output, "utf8"),
      );
      return { fileId, name: file.originalName, resultId: r.id };
    }
    default: {
      // 穷尽性检查：Operation 新增分支时会在编译期报错
      const exhaustive: never = op;
      throw new AppError(`未知操作：${JSON.stringify(exhaustive)}`, 400, "UNKNOWN_OP");
    }
  }
}

function opLabelOf(op: Operation): string {
  switch (op.op) {
    case "extract-text":
      return "提取文本";
    case "ocr":
      return "OCR";
    case "convert":
      return op.target.toUpperCase();
    case "ai":
      return op.action;
  }
}

/**
 * 执行批处理任务并写入任务记录。
 * 多文件时逐个执行：单个文件失败不影响其余文件，最终汇总为 partial 状态。
 */
export async function runTask(input: CreateTaskInput): Promise<TaskRecord> {
  const startedAt = Date.now();
  // 先生成任务 id：结果文件必须归属到它，下载与级联删除依赖该关联
  const taskId = randomUUID();
  const files = await Promise.all(input.fileIds.map((id) => fileStore.get(id)));

  const results: ItemResult[] = [];
  const aiOutputs: AiOutput[] = [];

  for (let i = 0; i < input.fileIds.length; i += 1) {
    const fileId = input.fileIds[i];
    try {
      const r = await runOnFile(taskId, input.op, fileId);
      results.push({ fileId, name: r.name, resultId: r.resultId });
      if (input.op.op === "ai" && r.resultId) {
        const rf = await resultStore.get(r.resultId);
        if (rf) {
          const buf = await readResult(rf.storedName);
          aiOutputs.push({ fileId, name: r.name, output: buf.toString("utf8") });
        }
      }
    } catch (err) {
      const message =
        err instanceof AppError
          ? err.message
          : `处理失败：${err instanceof Error ? err.message : String(err)}`;
      if (!(err instanceof AppError)) {
        console.error("[AnythingBox][task] 未预期错误", err);
      }
      results.push({
        fileId,
        name: files[i]?.originalName ?? fileId,
        error: message,
      });
    }
  }

  const ok = results.filter((r) => r.resultId);
  const failed = results.filter((r): r is ItemResult & { error: string } => Boolean(r.error));
  const status: TaskRecord["status"] =
    ok.length === 0 ? "failed" : failed.length > 0 ? "partial" : "completed";

  const errors: TaskError[] = failed.map((f) => ({ fileId: f.fileId, name: f.name, error: f.error }));
  const detail = buildDetail(input.op, status, ok.length, failed.length);

  const record: TaskRecord = {
    id: taskId,
    op: opId(input.op),
    opLabel: label(input.op),
    inputFiles: results.map((r) => ({ id: r.fileId, name: r.name })),
    status,
    createdAt: new Date(startedAt).toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    resultIds: ok.map((r) => r.resultId!).filter(Boolean),
    ...(input.op.op === "ai" ? { aiOutputs } : {}),
    ...(errors.length ? { errors } : {}),
    detail,
  };
  return taskStore.insert(record);
}

function opId(op: Operation): string {
  switch (op.op) {
    case "extract-text":
      return "extract-text";
    case "ocr":
      return "ocr";
    case "convert":
      return `convert:${op.target}`;
    case "ai":
      return `ai:${op.action}`;
    default: {
      const exhaustive: never = op;
      throw new AppError(`未知操作：${JSON.stringify(exhaustive)}`, 400, "UNKNOWN_OP");
    }
  }
}

function label(op: Operation): string {
  switch (op.op) {
    case "extract-text":
      return "提取文本";
    case "ocr":
      return "OCR 文字识别";
    case "convert":
      return `转换为 ${op.target.toUpperCase()}`;
    case "ai":
      return op.action === "summarize" ? "AI 文档总结" : op.action === "keypoints" ? "AI 重点提取" : "AI 文档问答";
    default: {
      const exhaustive: never = op;
      throw new AppError(`未知操作：${JSON.stringify(exhaustive)}`, 400, "UNKNOWN_OP");
    }
  }
}

function buildDetail(op: Operation, status: string, okCount: number, failCount: number): string {
  const parts: string[] = [`成功 ${okCount} 个文件`];
  if (failCount > 0) parts.push(`失败 ${failCount} 个`);
  if (op.op === "ai" && failCount > 0 && okCount === 0) {
    parts.push("常见原因：AI 服务未配置、密钥无效或网络超时，详见任务详情");
  }
  if (status === "completed") return parts.join("，");
  return `${parts.join("，")}。`;
}
