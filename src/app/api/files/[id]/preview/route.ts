import { NextRequest, NextResponse } from "next/server";
import { AppError, toPublicError } from "@/lib/errors";
import { fileStore, readUpload } from "@/lib/storage";
import { extractTextFromFile } from "@/lib/extract";
import { csvPreview } from "@/lib/preview";

export const runtime = "nodejs";

/** 文件内容预览：文本类返回前 N 个字符，CSV 额外返回表格结构 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const file = await fileStore.get(id);
    if (!file) {
      throw new AppError("文件不存在或已被删除", 404, "FILE_NOT_FOUND");
    }
    const buffer = await readUpload(file.storedName);

    if (file.kind === "csv") {
      const { table, text } = csvPreview(buffer.toString("utf8"), 15);
      return NextResponse.json({
        file,
        kind: file.kind,
        table,
        textPreview: text,
        truncated: true,
      });
    }

    if (file.kind === "image") {
      // 图片返回 base64 供前端直接展示
      return NextResponse.json({
        file,
        kind: file.kind,
        imageBase64: `data:${file.mimeType};base64,${buffer.toString("base64")}`,
      });
    }

    const { text, pages } = await extractTextFromFile(buffer, file.kind, file.originalName);
    const LIMIT = 4000;
    return NextResponse.json({
      file,
      kind: file.kind,
      textPreview: text.slice(0, LIMIT),
      pages,
      truncated: text.length > LIMIT,
    });
  } catch (err) {
    const { message, status, code } = toPublicError(err);
    return NextResponse.json({ error: message, code }, { status });
  }
}
