import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { AppError, toPublicError } from "@/lib/errors";
import { getConfig } from "@/lib/config";
import { createLogger } from "@/lib/logger";
import { fileStore, removeUploadBlob, writeUpload } from "@/lib/storage";
import { detectKind, mimeFor, sanitizeFilename } from "@/lib/file-utils";
import type { FileRecord } from "@/lib/types";

const log = createLogger("api:files");

export const runtime = "nodejs";

/** 列出全部已上传文件 */
export async function GET() {
  try {
    const files = await fileStore.all();
    return NextResponse.json({ files });
  } catch (err) {
    const { message, status, code } = toPublicError(err);
    return NextResponse.json({ error: message, code }, { status });
  }
}

/** 清空文件列表（同时删除全部上传 blob） */
export async function DELETE() {
  try {
    const files = await fileStore.all();
    for (const f of files) {
      await removeUploadBlob(f.storedName);
    }
    await fileStore.removeAll();
    log.info("已清空全部文件", { count: files.length });
    return NextResponse.json({ ok: true, count: files.length });
  } catch (err) {
    const { message, status, code } = toPublicError(err);
    return NextResponse.json({ error: message, code }, { status });
  }
}

/** 上传文件（multipart/form-data，字段名 files，可多个） */
export async function POST(req: NextRequest) {
  try {
    const cfg = getConfig();
    const form = await req.formData().catch(() => {
      throw new AppError("请求不是有效的表单数据", 400, "INVALID_FORM");
    });
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      throw new AppError("未选择任何文件", 400, "NO_FILES");
    }
    if (files.length > cfg.maxFilesPerUpload) {
      throw new AppError(`单次最多上传 ${cfg.maxFilesPerUpload} 个文件`, 413, "TOO_MANY_FILES");
    }

    const saved: FileRecord[] = [];
    const rejected: { name: string; reason: string }[] = [];

    for (const file of files) {
      const originalName = sanitizeFilename(file.name || "未命名文件");
      const ext = originalName.includes(".") ? originalName.split(".").pop()!.toLowerCase() : "";
      if (!detectKind(originalName)) {
        rejected.push({ name: originalName, reason: "不支持的文件类型" });
        continue;
      }
      if (file.size <= 0) {
        rejected.push({ name: originalName, reason: "文件为空" });
        continue;
      }
      if (file.size > cfg.maxFileSizeBytes) {
        rejected.push({
          name: originalName,
          reason: `超过大小限制（${Math.round(cfg.maxFileSizeBytes / 1024 / 1024)} MB）`,
        });
        continue;
      }
      const id = randomUUID();
      const storedName = `${id}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeUpload(storedName, buffer);
      const record: FileRecord = {
        id,
        originalName,
        storedName,
        extension: ext,
        kind: detectKind(originalName)!,
        mimeType: mimeFor(originalName),
        size: buffer.byteLength,
        uploadedAt: new Date().toISOString(),
      };
      await fileStore.insert(record);
      saved.push(record);
      log.info("文件已保存", { id, name: originalName, size: record.size });
    }

    if (saved.length === 0) {
      return NextResponse.json(
        { error: "所有文件都被拒绝", code: "ALL_REJECTED", rejected },
        { status: 422 },
      );
    }
    return NextResponse.json({ files: saved, rejected }, { status: 201 });
  } catch (err) {
    const { message, status, code } = toPublicError(err);
    log.error("上传失败", { message, code });
    return NextResponse.json({ error: message, code }, { status });
  }
}
