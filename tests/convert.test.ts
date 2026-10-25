import { describe, it, expect } from "vitest";
import { htmlToMarkdown, csvToJson, csvToMarkdown, jsonToCsv, textToPdf, markdownToDocxParagraphs } from "@/lib/convert";
import { htmlToPlainText, collapseWhitespace, decodeText } from "@/lib/extract";
import { AppError } from "@/lib/errors";

describe("htmlToPlainText", () => {
  it("移除脚本与样式，保留正文", () => {
    const html = `<html><head><style>body{color:red}</style></head>
      <body><script>alert(1)</script><h1>标题</h1><p>第一段</p><p>第二段</p></body></html>`;
    const text = htmlToPlainText(html);
    expect(text).toContain("标题");
    expect(text).toContain("第一段");
    expect(text).toContain("第二段");
    expect(text).not.toContain("alert");
    expect(text).not.toContain("color:red");
  });
});

describe("htmlToMarkdown", () => {
  it("标题、强调与链接", () => {
    const md = htmlToMarkdown("<h1>标题一</h1><p>这是 <strong>加粗</strong> 和 <em>斜体</em>，以及 <a href=\"https://example.com\">链接</a>。</p>");
    expect(md).toContain("# 标题一");
    expect(md).toContain("**加粗**");
    expect(md).toContain("*斜体*");
    expect(md).toContain("[链接](https://example.com)");
  });

  it("列表与代码块", () => {
    const md = htmlToMarkdown("<ul><li>项目一</li><li>项目二</li></ul><pre><code>const a = 1;</code></pre>");
    expect(md).toContain("- 项目一");
    expect(md).toContain("- 项目二");
    expect(md).toContain("const a = 1;");
  });

  it("表格转换为管道表格", () => {
    const md = htmlToMarkdown("<table><tr><th>名称</th><th>数量</th></tr><tr><td>苹果</td><td>3</td></tr></table>");
    expect(md).toContain("| 名称 | 数量 |");
    expect(md).toContain("| --- | --- |");
    expect(md).toContain("| 苹果 | 3 |");
  });
});

describe("CSV 转换", () => {
  const csv = "name,age\n张三,28\n李四,35";

  it("CSV → JSON", () => {
    const json = JSON.parse(csvToJson(csv, "a.csv")) as { name: string; age: string }[];
    expect(json).toHaveLength(2);
    expect(json[0].name).toBe("张三");
    expect(json[1].age).toBe("35");
  });

  it("CSV → Markdown 表格", () => {
    const md = csvToMarkdown(csv, "a.csv");
    expect(md).toContain("| name | age |");
    expect(md).toContain("| 张三 | 28 |");
  });

  it("TSV 按制表符解析", () => {
    const tsv = "a\tb\n1\t2";
    const json = JSON.parse(csvToJson(tsv, "a.tsv")) as Record<string, string>[];
    expect(json[0].a).toBe("1");
  });

  it("非法 CSV 报出明确错误", () => {
    expect(() => csvToJson('name,age\n"未闭合,28', "bad.csv")).toThrow(AppError);
  });
});

describe("JSON → CSV", () => {
  it("对象数组正确展开", () => {
    const csv = jsonToCsv('[{"name":"a","score":95},{"name":"b","score":88}]', "a.json");
    expect(csv).toContain("name,score");
    expect(csv).toContain("a,95");
    expect(csv).toContain("b,88");
  });

  it("非数组顶层给出明确错误", () => {
    expect(() => jsonToCsv('{"a":1}', "a.json")).toThrow(AppError);
  });

  it("非法 JSON 给出明确错误", () => {
    expect(() => jsonToCsv("{invalid", "a.json")).toThrow(AppError);
  });
});

describe("markdownToDocxParagraphs", () => {
  it("解析标题、列表与引用", () => {
    const paras = markdownToDocxParagraphs("# 标题\n- 项目\n> 引用内容\n普通段落");
    expect(paras.length).toBe(4);
  });
});

describe("textToPdf", () => {
  it("生成有效的 PDF 文件", async () => {
    const buf = await textToPdf("Hello AnythingBox\nThis is a real PDF.", "test.pdf");
    // %PDF 魔数与 %%EOF 尾标记
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
    expect(buf.toString("latin1")).toContain("%%EOF");
  });

  it("拒绝包含中文的内容并给出明确提示", async () => {
    await expect(textToPdf("中文内容", "t.pdf")).rejects.toThrow(/西文/);
  });

  it("长文本自动换页", async () => {
    const lines = Array.from({ length: 200 }, (_, i) => `Line ${i} lorem ipsum dolor sit amet consectetur`).join("\n");
    const buf = await textToPdf(lines, "long.pdf");
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
    // 用 pdf-lib 重新加载验证页数 > 1（对象流已压缩，无法从文本直接检索）
    const { PDFDocument } = await import("pdf-lib");
    const pdf = await PDFDocument.load(buf);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
  });
});

describe("文本处理工具", () => {
  it("decodeText 去除 BOM", () => {
    const buf = Buffer.from("\uFEFFhello", "utf8");
    expect(decodeText(buf)).toBe("hello");
  });

  it("collapseWhitespace 压缩空白但保留段落", () => {
    const out = collapseWhitespace("标题\n   多余   空格\n\n\n\n\n第二段");
    expect(out).toBe("标题\n多余 空格\n\n第二段");
  });
});
