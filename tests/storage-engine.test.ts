import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { resetConfigCache } from "@/lib/config";
import {
  fileStore,
  taskStore,
  resultStore,
  writeUpload,
  readUpload,
  readResult,
  removeUploadBlob,
  clearAllData,
  storageStats,
} from "@/lib/storage";
import { extractTextFromFile } from "@/lib/extract";
import { runTask } from "@/lib/engine";
import type { FileRecord } from "@/lib/types";

let dataDir: string;
const ORIG = { ...process.env };

async function makeFile(overrides: Partial<FileRecord> = {}): Promise<FileRecord> {
  const id = randomUUID();
  const record: FileRecord = {
    id,
    originalName: `test-${id.slice(0, 6)}.txt`,
    storedName: `${id}.txt`,
    extension: "txt",
    kind: "text",
    mimeType: "text/plain",
    size: 0,
    uploadedAt: new Date().toISOString(),
    ...overrides,
  };
  const content = overrides.originalName?.endsWith(".md")
    ? `# ${record.originalName}\n\n测试内容 ${id}`
    : `这是测试文件 ${id} 的内容。\n第二行。`;
  const buf = Buffer.from(content, "utf8");
  record.size = buf.byteLength;
  await writeUpload(record.storedName, buf);
  return fileStore.insert(record);
}

beforeEach(async () => {
  resetConfigCache();
  dataDir = await fs.mkdtemp(path.join(tmpdir(), "ab-engine-"));
  process.env.DATA_DIR = path.join(dataDir, "data");
  resetConfigCache();
});

afterEach(async () => {
  process.env = { ...ORIG };
  resetConfigCache();
  await fs.rm(dataDir, { recursive: true, force: true });
});

describe("storage", () => {
  it("写入并读取上传文件", async () => {
    const f = await makeFile();
    const buf = await readUpload(f.storedName);
    expect(buf.toString("utf8")).toContain(f.id.slice(0, 6));
  });

  it("文件增删改查与排序（最新在前）", async () => {
    const a = await makeFile({ originalName: "a.txt" });
    await new Promise((r) => setTimeout(r, 5));
    const b = await makeFile({ originalName: "b.txt" });
    const all = await fileStore.all();
    expect(all[0].id).toBe(b.id);
    expect((await fileStore.get(a.id))?.originalName).toBe("a.txt");

    await fileStore.update(a.id, { originalName: "a2.txt" });
    expect((await fileStore.get(a.id))?.originalName).toBe("a2.txt");

    await fileStore.remove(b.id);
    await removeUploadBlob(b.storedName);
    expect(await fileStore.get(b.id)).toBeNull();
    await expect(readUpload(b.storedName)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("清空数据后统计归零", async () => {
    await makeFile();
    await clearAllData();
    const stats = await storageStats();
    expect(stats.fileCount).toBe(0);
  });
});

describe("extractTextFromFile", () => {
  it("读取 txt", async () => {
    const { text } = await extractTextFromFile(Buffer.from("hello world"), "text", "a.txt");
    expect(text).toBe("hello world");
  });

  it("图片类型提示使用 OCR", async () => {
    await expect(
      extractTextFromFile(Buffer.from(""), "image", "a.png"),
    ).rejects.toMatchObject({ code: "USE_OCR" });
  });

  it("损坏的 PDF 报出明确错误", async () => {
    await expect(
      extractTextFromFile(Buffer.from("not a pdf"), "pdf", "broken.pdf"),
    ).rejects.toMatchObject({ code: "PDF_EXTRACT_FAILED" });
  });
});

describe("runTask", () => {
  it("批量提取文本：全部成功", async () => {
    const f1 = await makeFile();
    const f2 = await makeFile();
    const task = await runTask({ op: { op: "extract-text" }, fileIds: [f1.id, f2.id] });
    expect(task.status).toBe("completed");
    expect(task.resultIds).toHaveLength(2);
    expect(task.op).toBe("extract-text");
    // 结果文件必须归属到真实任务 id（回归：曾出现 taskId="pending" 导致按任务下载失效）
    const first = await resultStore.get(task.resultIds[0]);
    expect(first?.taskId).toBe(task.id);
    // 结果文件真实存在且包含原文
    const result = await resultStore.get(task.resultIds[0]);
    expect(result).not.toBeNull();
    const buf = await readResult(result!.storedName);
    expect(buf.toString("utf8")).toContain("测试文件");
  });

  it("批量提取：单文件失败不影响其他文件，状态为 partial", async () => {
    const good = await makeFile();
    const ghost = { ...good, id: randomUUID() }; // 不存在于存储中的文件
    const task = await runTask({ op: { op: "extract-text" }, fileIds: [good.id, ghost.id] });
    expect(task.status).toBe("partial");
    expect(task.resultIds).toHaveLength(1);
    expect(task.errors).toHaveLength(1);
    expect(task.errors![0].fileId).toBe(ghost.id);
  });

  it("全部失败时状态为 failed", async () => {
    const ghost = randomUUID();
    const task = await runTask({ op: { op: "extract-text" }, fileIds: [ghost] });
    expect(task.status).toBe("failed");
    expect(task.resultIds).toHaveLength(0);
  });

  it("CSV → JSON 真实转换", async () => {
    const id = randomUUID();
    const csv = "name,city\n张三,北京\n李四,上海";
    await writeUpload(`${id}.csv`, Buffer.from(csv, "utf8"));
    const file = await fileStore.insert({
      id,
      originalName: "city.csv",
      storedName: `${id}.csv`,
      extension: "csv",
      kind: "csv",
      mimeType: "text/csv",
      size: Buffer.byteLength(csv),
      uploadedAt: new Date().toISOString(),
    });
    const task = await runTask({ op: { op: "convert", target: "json" }, fileIds: [file.id] });
    expect(task.status).toBe("completed");
    const result = await resultStore.get(task.resultIds[0]);
    expect(result?.name).toBe("city - 转换为JSON.json");
    const out = (await readResult(result!.storedName)).toString("utf8");
    const parsed = JSON.parse(out) as { name: string; city: string }[];
    expect(parsed[0].city).toBe("北京");
  });

  it("AI 任务在未配置密钥时失败且错误信息清晰", async () => {
    delete process.env.AI_API_KEY;
    resetConfigCache();
    const f = await makeFile();
    const task = await runTask({ op: { op: "ai", action: "summarize" }, fileIds: [f.id] });
    expect(task.status).toBe("failed");
    expect(task.errors![0].error).toContain("AI_API_KEY");
  });

  it("任务记录可查询与级联删除", async () => {
    const f = await makeFile();
    const task = await runTask({ op: { op: "extract-text" }, fileIds: [f.id] });
    expect((await taskStore.all())).toHaveLength(1);
    const { deleteTaskCascade } = await import("@/lib/storage");
    const removed = await deleteTaskCascade(task.id);
    expect(removed?.id).toBe(task.id);
    expect(await taskStore.get(task.id)).toBeNull();
    expect((await resultStore.all())).toHaveLength(0);
  });
});
