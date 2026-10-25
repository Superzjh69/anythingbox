import { NextRequest, NextResponse } from "next/server";
import { toPublicError } from "@/lib/errors";
import { deleteTaskCascade, taskStore } from "@/lib/storage";
import { createLogger } from "@/lib/logger";

const log = createLogger("api:tasks");

export const runtime = "nodejs";

/** 任务列表（含 AI 输出与错误详情） */
export async function GET() {
  try {
    const tasks = await taskStore.all();
    return NextResponse.json({ tasks });
  } catch (err) {
    const { message, status, code } = toPublicError(err);
    return NextResponse.json({ error: message, code }, { status });
  }
}

/** 删除单个任务（级联删除其结果文件） */
export async function DELETE(req: NextRequest) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "缺少任务 id" }, { status: 400 });
    }
    const removed = await deleteTaskCascade(id);
    if (!removed) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }
    log.info("任务已删除", { id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { message, status, code } = toPublicError(err);
    return NextResponse.json({ error: message, code }, { status });
  }
}
