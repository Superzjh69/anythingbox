import { NextRequest, NextResponse } from "next/server";
import { toPublicError } from "@/lib/errors";
import { fileStore, removeUploadBlob } from "@/lib/storage";
import { createLogger } from "@/lib/logger";

const log = createLogger("api:file");

export const runtime = "nodejs";

/** 删除单个文件（同时删除磁盘 blob） */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const removed = await fileStore.remove(id);
    if (!removed) {
      return NextResponse.json({ error: "文件不存在" }, { status: 404 });
    }
    await removeUploadBlob(removed.storedName);
    log.info("文件已删除", { id, name: removed.originalName });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { message, status, code } = toPublicError(err);
    return NextResponse.json({ error: message, code }, { status });
  }
}

/** 查询单个文件信息 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const file = await fileStore.get(id);
    if (!file) {
      return NextResponse.json({ error: "文件不存在" }, { status: 404 });
    }
    return NextResponse.json({ file });
  } catch (err) {
    const { message, status, code } = toPublicError(err);
    return NextResponse.json({ error: message, code }, { status });
  }
}
