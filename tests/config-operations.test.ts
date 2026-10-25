import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { resetConfigCache, getConfig } from "@/lib/config";
import { operationLabel, convertOpId, aiOpId, commonTargets } from "@/lib/operations";

describe("config", () => {
  const ORIG = { ...process.env };
  let dataDir: string;

  beforeEach(async () => {
    resetConfigCache();
    dataDir = await fs.mkdtemp(path.join(tmpdir(), "anythingbox-test-"));
    process.env.DATA_DIR = path.join(dataDir, "data");
    delete process.env.AI_API_KEY;
  });

  afterEach(async () => {
    process.env = { ...ORIG };
    resetConfigCache();
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  it("默认配置：AI 未配置、20MB 上限", () => {
    const cfg = getConfig();
    expect(cfg.aiConfigured).toBe(false);
    expect(cfg.maxFileSizeBytes).toBe(20 * 1024 * 1024);
    expect(cfg.maxFilesPerUpload).toBe(20);
    expect(cfg.aiModel).toBe("gpt-4o-mini");
  });

  it("设置密钥后 aiConfigured 为 true", () => {
    process.env.AI_API_KEY = "sk-test-123";
    const cfg = getConfig();
    expect(cfg.aiConfigured).toBe(true);
  });

  it("AI_BASE_URL 去除尾部斜杠", () => {
    process.env.AI_API_KEY = "sk-test";
    process.env.AI_BASE_URL = "https://api.example.com/v1///";
    expect(getConfig().aiBaseUrl).toBe("https://api.example.com/v1");
  });

  it("MAX_FILE_SIZE_MB 换算为字节", () => {
    process.env.MAX_FILE_SIZE_MB = "5";
    expect(getConfig().maxFileSizeBytes).toBe(5 * 1024 * 1024);
  });
});

describe("operations", () => {
  it("操作 id 与标签一一对应", () => {
    expect(operationLabel("extract-text")).toBe("提取文本");
    expect(operationLabel("ocr")).toBe("OCR 文字识别");
    expect(operationLabel(convertOpId("docx"))).toBe("转换为 Word 文档");
    expect(operationLabel(aiOpId("summarize"))).toBe("AI 文档总结");
    expect(operationLabel("unknown-op")).toBe("unknown-op");
  });

  it("commonTargets 取多类型交集", () => {
    // text 与 markdown 都能转 docx / pdf / html
    const targets = commonTargets(["text", "markdown"]);
    expect(targets).toContain("docx");
    expect(targets).toContain("pdf");
    // image 无转换能力
    expect(commonTargets(["image", "text"])).toEqual([]);
  });
});
