import { NextRequest, NextResponse } from "next/server";
import { toPublicError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { resultStore } from "@/lib/storage";
import JSZip from "jszip";
import { readResult, taskStore } from "@/lib/storage";

const log = createLogger("api:download");

export const runtime = "nodejs";

function safeZipName(name: string): string {
  return name.replace(/["'/:*?|<>\\]/g, "-");
}

/**
 * 结果下载：
 *   /api/download?resultId=xxx            单文件下载
 *   /api/download?taskId=xxx&zip=1        任务结果打包 ZIP（单结果时也可强制 zip=1）
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const resultId = searchParams.get("resultId");
    const taskId = searchParams.get("taskId");
    const asZip = searchParams.get("zip") === "1";

    if (resultId) {
      const result = await resultStore.get(resultId);
      if (!result) {
        return NextResponse.json({ error: "结果文件不存在或已被删除" }, { status: 404 });
      }
      const data = await readResult(result.storedName);
      return new NextResponse(new Uint8Array(data), {
        headers: {
          "Content-Type": result.mimeType,
          "Content-Length": String(data.byteLength),
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(result.name)}`,
        },
      });
    }

    if (taskId) {
      const task = await taskStore.get(taskId);
      if (!task) {
        return NextResponse.json({ error: "任务不存在" }, { status: 404 });
      }
      const results = (await resultStore.all()).filter((r) => r.taskId === taskId);
      if (results.length === 0) {
        return NextResponse.json({ error: "该任务没有可下载的结果" }, { status: 404 });
      }
      if (results.length === 1 && !asZip) {
        const data = await readResult(results[0].storedName);
        return new NextResponse(new Uint8Array(data), {
          headers: {
            "Content-Type": results[0].mimeType,
            "Content-Length": String(data.byteLength),
            "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(results[0].name)}`,
          },
        });
      }
      const zip = new JSZip();
      const used = new Map<string, number>();
      for (const r of results) {
        let name = safeZipName(r.name);
        const n = used.get(name) ?? 0;
        used.set(name, n + 1);
        if (n > 0) {
          const dot = name.lastIndexOf(".");
          const stem = dot > 0 ? name.slice(0, dot) : name;
          const ext = dot > 0 ? name.slice(dot) : "";
          name = `${stem} (${n + 1})${ext}`;
        }
        zip.file(name, await readResult(r.storedName));
      }
      const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
      log.info("打包下载", { taskId, count: results.length });
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Length": String(buf.byteLength),
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`anythingbox-results-${taskId.slice(0, 8)}.zip`)}`,
        },
      });
    }

    return NextResponse.json({ error: "缺少 resultId 或 taskId 参数" }, { status: 400 });
  } catch (err) {
    const { message, status, code } = toPublicError(err);
    log.error("下载失败", { message, code });
    return NextResponse.json({ error: message, code }, { status });
  }
}
