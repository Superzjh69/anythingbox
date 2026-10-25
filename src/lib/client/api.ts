"use client";

import type { FileRecord, ResultFile, TaskRecord } from "@/lib/types";

export interface PublicConfig {
  aiConfigured: boolean;
  aiBaseUrl: string;
  aiModel: string;
  aiTimeoutMs: number;
  hasApiKey: boolean;
  maxFileSizeBytes: number;
  maxFilesPerUpload: number;
}

export interface Stats {
  fileCount: number;
  taskCount: number;
  resultCount: number;
}

export interface UploadRejection {
  name: string;
  reason: string;
}

interface ErrorBody {
  error?: string;
  code?: string;
  rejected?: UploadRejection[];
}

async function parseError(res: Response): Promise<never> {
  let body: ErrorBody = {};
  try {
    body = (await res.json()) as ErrorBody;
  } catch {
    // 非 JSON 响应
  }
  const message = body.error || `请求失败（HTTP ${res.status}）`;
  const err = new Error(message) as Error & { code?: string; rejected?: UploadRejection[] };
  err.code = body.code;
  err.rejected = body.rejected;
  throw err;
}

// ── 配置 ───────────────────────────────────────────────────

export async function fetchConfig(): Promise<{ config: PublicConfig; stats: Stats }> {
  const res = await fetch("/api/config", { cache: "no-store" });
  if (!res.ok) await parseError(res);
  return res.json();
}

// ── 文件 ───────────────────────────────────────────────────

export async function listFiles(): Promise<FileRecord[]> {
  const res = await fetch("/api/files", { cache: "no-store" });
  if (!res.ok) await parseError(res);
  const data = (await res.json()) as { files: FileRecord[] };
  return data.files;
}

/** 使用 XHR 上传以获得进度回调 */
export function uploadFiles(
  files: File[],
  onProgress: (percent: number) => void,
): Promise<{ files: FileRecord[]; rejected: UploadRejection[] }> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const f of files) form.append("files", f);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/files");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // 忽略
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as { files: FileRecord[]; rejected: UploadRejection[] });
      } else {
        const b = (body ?? {}) as ErrorBody;
        const err = new Error(b.error || `上传失败（HTTP ${xhr.status}）`) as Error & {
          rejected?: UploadRejection[];
        };
        err.rejected = b.rejected;
        reject(err);
      }
    };
    xhr.onerror = () => reject(new Error("网络错误，上传中断"));
    xhr.onabort = () => reject(new Error("上传已取消"));
    xhr.send(form);
  });
}

export async function deleteFile(id: string): Promise<void> {
  const res = await fetch(`/api/files/${id}`, { method: "DELETE" });
  if (!res.ok) await parseError(res);
}

export async function clearFiles(): Promise<void> {
  const res = await fetch("/api/files", { method: "DELETE" });
  if (!res.ok) await parseError(res);
}

// ── 处理 ───────────────────────────────────────────────────

export interface ProcessPayload {
  op: "extract-text" | "ocr" | "convert" | "ai";
  target?: string;
  action?: string;
  question?: string;
  fileIds: string[];
}

export async function runProcess(payload: ProcessPayload): Promise<TaskRecord> {
  const res = await fetch("/api/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) await parseError(res);
  const data = (await res.json()) as { task: TaskRecord };
  return data.task;
}

// ── 任务与结果 ─────────────────────────────────────────────

export async function listTasks(): Promise<TaskRecord[]> {
  const res = await fetch("/api/tasks", { cache: "no-store" });
  if (!res.ok) await parseError(res);
  const data = (await res.json()) as { tasks: TaskRecord[] };
  return data.tasks;
}

export async function deleteTask(id: string): Promise<void> {
  const res = await fetch(`/api/tasks?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) await parseError(res);
}

export async function listResults(): Promise<ResultFile[]> {
  const res = await fetch("/api/results", { cache: "no-store" });
  if (!res.ok) await parseError(res);
  const data = (await res.json()) as { results: ResultFile[] };
  return data.results;
}

export async function clearAllData(): Promise<void> {
  const res = await fetch("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirm: "RESET" }),
  });
  if (!res.ok) await parseError(res);
}

// ── 下载 ───────────────────────────────────────────────────

export function resultDownloadUrl(resultId: string): string {
  return `/api/download?resultId=${encodeURIComponent(resultId)}`;
}

export function taskDownloadUrl(taskId: string, zip: boolean): string {
  return `/api/download?taskId=${encodeURIComponent(taskId)}${zip ? "&zip=1" : ""}`;
}
