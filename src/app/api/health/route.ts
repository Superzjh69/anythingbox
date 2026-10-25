import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** 健康检查 */
export async function GET() {
  return NextResponse.json({ ok: true, name: "AnythingBox", time: new Date().toISOString() });
}
