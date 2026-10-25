import { NextResponse } from "next/server";
import { toPublicError } from "@/lib/errors";
import { resultStore } from "@/lib/storage";

export const runtime = "nodejs";

/** 结果文件列表（任务详情页展示下载入口） */
export async function GET() {
  try {
    const results = await resultStore.all();
    return NextResponse.json({ results });
  } catch (err) {
    const { message, status, code } = toPublicError(err);
    return NextResponse.json({ error: message, code }, { status });
  }
}
