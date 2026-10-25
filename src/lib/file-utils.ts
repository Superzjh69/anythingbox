import type { FileKind } from "./types";

/** 扩展名（小写、无点） → 文件类别 */
export const EXTENSION_KIND: Record<string, FileKind> = {
  txt: "text",
  log: "text",
  text: "text",
  md: "markdown",
  markdown: "markdown",
  mdx: "markdown",
  csv: "csv",
  tsv: "csv",
  json: "json",
  html: "html",
  htm: "html",
  pdf: "pdf",
  docx: "docx",
  png: "image",
  jpg: "image",
  jpeg: "image",
  webp: "image",
  bmp: "image",
  tif: "image",
  tiff: "image",
};

export const KIND_LABEL: Record<FileKind, string> = {
  text: "文本",
  markdown: "Markdown",
  csv: "表格",
  json: "JSON",
  html: "HTML",
  pdf: "PDF",
  docx: "Word",
  image: "图片",
};

const MIME_BY_EXT: Record<string, string> = {
  txt: "text/plain",
  log: "text/plain",
  text: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  mdx: "text/markdown",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  json: "application/json",
  html: "text/html",
  htm: "text/html",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
};

export const SUPPORTED_EXTENSIONS = Object.keys(EXTENSION_KIND);

export function getExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  if (idx <= 0 || idx === name.length - 1) return "";
  return name.slice(idx + 1).toLowerCase();
}

export function detectKind(name: string): FileKind | null {
  return EXTENSION_KIND[getExtension(name)] ?? null;
}

export function mimeFor(name: string): string {
  return MIME_BY_EXT[getExtension(name)] ?? "application/octet-stream";
}

/**
 * 消毒文件名：去掉路径分隔符与控制字符，限制长度。
 * 保留中文等常用非 ASCII 字符，仅移除 Windows / Unix 下有特殊含义的部分。
 */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .replace(/[\u0000-\u001f<>:"|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || cleaned === "." || cleaned === "..") return "file";
  // 保留扩展名完整，主体限制在 120 字符内
  const ext = getExtension(cleaned);
  const stem = ext ? cleaned.slice(0, cleaned.length - ext.length - 1) : cleaned;
  const limitedStem = stem.length > 120 ? stem.slice(0, 120) : stem;
  return ext ? `${limitedStem}.${ext}` : limitedStem;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let val = bytes / 1024;
  let unit = 0;
  while (val >= 1024 && unit < units.length - 1) {
    val /= 1024;
    unit += 1;
  }
  return `${val >= 100 ? Math.round(val) : val.toFixed(1)} ${units[unit]}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.max(1, Math.round(ms))} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m} 分 ${s} 秒`;
}
