import type { FileKind, TargetFormat } from "./types";

// ── 目标格式 ───────────────────────────────────────────────

export const FORMATS: Record<TargetFormat, { label: string; ext: string }> = {
  txt: { label: "纯文本", ext: "txt" },
  md: { label: "Markdown", ext: "md" },
  html: { label: "HTML 网页", ext: "html" },
  docx: { label: "Word 文档", ext: "docx" },
  pdf: { label: "PDF", ext: "pdf" },
  json: { label: "JSON", ext: "json" },
  csv: { label: "CSV 表格", ext: "csv" },
};

/** 各源格式可真实转换到的目标格式矩阵 */
export const CONVERSION_MATRIX: Record<FileKind, TargetFormat[]> = {
  text: ["md", "html", "docx", "pdf"],
  markdown: ["txt", "html", "docx", "pdf"],
  html: ["txt", "md"],
  csv: ["json", "md", "html"],
  json: ["csv"],
  pdf: ["txt", "md"],
  docx: ["txt", "md", "html"],
  image: [],
};

/** 支持直接提取文本的类别（不含图片，图片走 OCR） */
export const TEXT_EXTRACTABLE_KINDS: FileKind[] = [
  "text",
  "markdown",
  "csv",
  "json",
  "html",
  "pdf",
  "docx",
];

export const AI_SUPPORTED_KINDS: FileKind[] = [...TEXT_EXTRACTABLE_KINDS, "image"];

// ── 操作 id 构建 ───────────────────────────────────────────

export type Operation =
  | { op: "extract-text" }
  | { op: "ocr" }
  | { op: "convert"; target: TargetFormat }
  | { op: "ai"; action: AiAction; question?: string };

export type AiAction = "summarize" | "keypoints" | "ask";

export function convertOpId(target: TargetFormat): string {
  return `convert:${target}`;
}

export function aiOpId(action: AiAction): string {
  return `ai:${action}`;
}

/** 操作 id → 用户可读标签（与处理引擎保持单一来源） */
export function operationLabel(op: string): string {
  if (op === "extract-text") return "提取文本";
  if (op === "ocr") return "OCR 文字识别";
  if (op.startsWith("convert:")) {
    const target = op.slice(8) as TargetFormat;
    const f = FORMATS[target];
    return f ? `转换为 ${f.label}` : `转换为 ${target}`;
  }
  if (op === "ai:summarize") return "AI 文档总结";
  if (op === "ai:keypoints") return "AI 重点提取";
  if (op === "ai:ask") return "AI 文档问答";
  return op;
}

/** 多个源格式的公共可转换目标（用于批量转换时取交集） */
export function commonTargets(kinds: FileKind[]): TargetFormat[] {
  const unique = [...new Set(kinds)];
  if (unique.length === 0) return [];
  const [first, ...rest] = unique.map((k) => CONVERSION_MATRIX[k] ?? []);
  return first.filter((t) => rest.every((list) => list.includes(t)));
}
