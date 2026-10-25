import { describe, it, expect } from "vitest";
import {
  detectKind,
  getExtension,
  mimeFor,
  sanitizeFilename,
  formatBytes,
  formatDuration,
  SUPPORTED_EXTENSIONS,
} from "@/lib/file-utils";

describe("getExtension", () => {
  it("提取小写扩展名", () => {
    expect(getExtension("报告.PDF")).toBe("pdf");
    expect(getExtension("a.b.txt")).toBe("txt");
  });

  it("无扩展名或以点开头时返回空串", () => {
    expect(getExtension("noext")).toBe("");
    expect(getExtension(".hidden")).toBe("");
    expect(getExtension("trailing.")).toBe("");
  });
});

describe("detectKind", () => {
  it("按扩展名识别文件类别", () => {
    expect(detectKind("a.md")).toBe("markdown");
    expect(detectKind("b.CSV")).toBe("csv");
    expect(detectKind("c.docx")).toBe("docx");
    expect(detectKind("d.png")).toBe("image");
  });

  it("不认识的扩展名返回 null", () => {
    expect(detectKind("virus.exe")).toBeNull();
    expect(detectKind("noext")).toBeNull();
  });

  it("支持的扩展名集合非空且包含核心类型", () => {
    for (const ext of ["txt", "md", "csv", "json", "html", "pdf", "docx", "png"]) {
      expect(SUPPORTED_EXTENSIONS).toContain(ext);
    }
  });
});

describe("mimeFor", () => {
  it("返回正确的 MIME 类型", () => {
    expect(mimeFor("a.pdf")).toBe("application/pdf");
    expect(mimeFor("a.csv")).toBe("text/csv");
    expect(mimeFor("unknown.bin")).toBe("application/octet-stream");
  });
});

describe("sanitizeFilename", () => {
  it("去除路径分隔符，防止路径穿越", () => {
    expect(sanitizeFilename("../../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("..\\..\\windows\\system32\\evil.dll")).toBe("evil.dll");
  });

  it("去除 Windows 非法字符与控制字符", () => {
    expect(sanitizeFilename('a<b>c:d"e|f?g*h.txt')).toBe("abcdefgh.txt");
    expect(sanitizeFilename("bad\u0000name.txt")).toBe("badname.txt");
  });

  it("保留中文等非 ASCII 字符", () => {
    expect(sanitizeFilename("季度报告 2026.pdf")).toBe("季度报告 2026.pdf");
  });

  it("空文件名与特殊目录名回退为 file", () => {
    expect(sanitizeFilename("")).toBe("file");
    expect(sanitizeFilename("..")).toBe("file");
  });

  it("超长文件名主体被截断但保留扩展名", () => {
    const name = `${"长".repeat(300)}.pdf`;
    const out = sanitizeFilename(name);
    expect(out.endsWith(".pdf")).toBe(true);
    expect(out.length).toBeLessThan(300);
  });
});

describe("formatBytes", () => {
  it("按量级选择单位", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
    expect(formatBytes(2.5 * 1024 * 1024)).toBe("2.5 MB");
  });

  it("非法输入返回占位符", () => {
    expect(formatBytes(-1)).toBe("-");
    expect(formatBytes(Number.NaN)).toBe("-");
  });
});

describe("formatDuration", () => {
  it("毫秒 / 秒 / 分钟", () => {
    expect(formatDuration(400)).toBe("400 ms");
    expect(formatDuration(1200)).toBe("1.2 s");
    expect(formatDuration(61_500)).toBe("1 分 2 秒");
  });
});
