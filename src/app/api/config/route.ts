import { NextRequest, NextResponse } from "next/server";
import { toPublicError } from "@/lib/errors";
import { clearAllData, storageStats } from "@/lib/storage";
import { getConfig } from "@/lib/config";
import { createLogger } from "@/lib/logger";

const log = createLogger("api:config");

export const runtime = "nodejs";

function clientConfig() {
  const cfg = getConfig();
  return {
    aiConfigured: cfg.aiConfigured,
    aiBaseUrl: cfg.aiBaseUrl,
    aiModel: cfg.aiModel,
    aiTimeoutMs: cfg.aiTimeoutMs,
    // 永远不把 API Key 返回给前端
    hasApiKey: Boolean(cfg.aiApiKey),
    maxFileSizeBytes: cfg.maxFileSizeBytes,
    maxFilesPerUpload: cfg.maxFilesPerUpload,
  };
}

/** 返回可供前端使用的公共配置（不含密钥） */
export async function GET() {
  try {
    const stats = await storageStats();
    return NextResponse.json({ config: clientConfig(), stats });
  } catch (err) {
    const { message, status, code } = toPublicError(err);
    return NextResponse.json({ error: message, code }, { status });
  }
}

/** 清空全部数据（文件、任务、结果）。需要 body: { confirm: "RESET" } */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { confirm?: string } | null;
    if (body?.confirm !== "RESET") {
      return NextResponse.json(
        { error: "请传入 { \"confirm\": \"RESET\" } 以确认清空操作" },
        { status: 400 },
      );
    }
    await clearAllData();
    const stats = await storageStats();
    log.info("数据已全部清空");
    return NextResponse.json({ ok: true, stats, config: clientConfig() });
  } catch (err) {
    const { message, status, code } = toPublicError(err);
    return NextResponse.json({ error: message, code }, { status });
  }
}
