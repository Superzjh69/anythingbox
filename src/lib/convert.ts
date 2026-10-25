import { marked } from "marked";
import { parse as parseHtml, HTMLElement } from "node-html-parser";
import Papa from "papaparse";
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import mammoth from "mammoth";
import { AppError } from "./errors";
import { collapseWhitespace, decodeText, extractTextFromFile, htmlToPlainText } from "./extract";
import { CONVERSION_MATRIX, FORMATS } from "./operations";
import { KIND_LABEL, getExtension } from "./file-utils";
import type { FileKind, TargetFormat } from "./types";

export interface ConvertOutput {
  data: Buffer;
  mimeType: string;
  ext: string;
}

export const RESULT_MIME: Record<string, string> = {
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  html: "text/html; charset=utf-8",
  json: "application/json; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
};

// ── 基础工具 ───────────────────────────────────────────────

export function normalizeText(text: string): string {
  return text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "");
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function htmlDocument(title: string, body: string): string {
  return `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif;
         max-width: 46rem; margin: 3rem auto; padding: 0 1.25rem; line-height: 1.75; color: #1c1917; }
  h1,h2,h3,h4 { line-height: 1.3; margin-top: 2em; }
  table { border-collapse: collapse; width: 100%; margin: 1.5rem 0; font-size: 0.95em; }
  th, td { border: 1px solid #d6d3d1; padding: 0.5rem 0.75rem; text-align: left; }
  th { background: #f5f5f4; }
  blockquote { border-left: 3px solid #d6d3d1; margin: 1.5rem 0; padding: 0.25rem 1rem; color: #57534e; }
  code { background: #f5f5f4; padding: 0.15em 0.4em; border-radius: 4px; font-size: 0.9em; }
  pre { background: #f5f5f4; padding: 1rem; border-radius: 8px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  @media print { body { margin: 1.5cm; } }
</style>
</head>
<body>
${body}
</body>
</html>
`;
}

// ── Markdown / HTML 互转 ───────────────────────────────────

export async function markdownToHtmlBody(md: string): Promise<string> {
  return marked.parse(md, { async: false, gfm: true, breaks: false });
}

export async function markdownToText(md: string): Promise<string> {
  const html = await markdownToHtmlBody(md);
  return htmlToPlainText(html);
}

/** 将 HTML 结构转换为 Markdown（支持标题、列表、链接、图片、引用、代码块等常用元素） */
export function htmlToMarkdown(html: string): string {
  const root = parseHtml(html);
  root.querySelectorAll("script,style,noscript").forEach((el) => el.remove());

  function inline(node: import("node-html-parser").Node): string {
    if (node.nodeType === 3) return node.text ?? "";
    if (!(node instanceof HTMLElement)) return "";
    const tag = node.tagName.toLowerCase();
    const kids = () => node.childNodes.map(inline).join("");
    switch (tag) {
      case "strong":
      case "b": {
        const t = kids().trim();
        return t ? `**${t}**` : "";
      }
      case "em":
      case "i": {
        const t = kids().trim();
        return t ? `*${t}*` : "";
      }
      case "code":
        return `\`${node.text}\``;
      case "a": {
        const href = node.getAttribute("href") ?? "";
        const t = kids().trim() || href;
        return href ? `[${t}](${href})` : t;
      }
      case "img": {
        const src = node.getAttribute("src") ?? "";
        const alt = node.getAttribute("alt") ?? "";
        return src ? `![${alt}](${src})` : "";
      }
      case "br":
        return "\n";
      default:
        return kids();
    }
  }

  function listItems(el: HTMLElement, ordered: boolean, depth: number): string[] {
    const out: string[] = [];
    let index = 1;
    for (const li of el.querySelectorAll(":scope > li")) {
      const nested: string[] = [];
      for (const sub of li.querySelectorAll(":scope > ul, :scope > ol")) {
        sub.remove();
        nested.push(...listItems(sub, sub.tagName.toLowerCase() === "ol", depth + 1));
      }
      const text = inline(li).replace(/\n{2,}/g, "\n").trim();
      const prefix = ordered ? `${index++}. ` : "- ";
      const pad = "  ".repeat(depth);
      out.push(`${pad}${prefix}${text}`);
      out.push(...nested);
    }
    return out;
  }

  function block(el: HTMLElement): string[] {
    const tag = (el.tagName ?? "").toLowerCase();
    switch (tag) {
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6": {
        const level = Number(tag[1]);
        const t = inline(el).trim();
        return t ? [`${"#".repeat(level)} ${t}`] : [];
      }
      case "p": {
        const t = inline(el).trim();
        return t ? [t] : [];
      }
      case "pre": {
        const code = el.text.replace(/\n+$/, "");
        return ["```", code, "```"];
      }
      case "blockquote": {
        const inner = el.childNodes
          .filter((n) => n instanceof HTMLElement)
          .flatMap((n) => block(n as HTMLElement))
          .join("\n");
        const text = inner || inline(el).trim();
        return text ? text.split("\n").map((l) => `> ${l}`.trimEnd()) : [];
      }
      case "ul":
        return listItems(el, false, 0);
      case "ol":
        return listItems(el, true, 0);
      case "hr":
        return ["---"];
      case "br":
        return [];
      case "table": {
        const rows = el.querySelectorAll("tr");
        if (rows.length === 0) return [];
        const lines: string[] = [];
        rows.forEach((tr, i) => {
          const cells = tr.querySelectorAll("th,td").map((c) => inline(c).trim().replace(/\|/g, "\\|").replace(/\n/g, " "));
          lines.push(`| ${cells.join(" | ")} |`);
          if (i === 0) lines.push(`| ${cells.map(() => "---").join(" | ")} |`);
        });
        return lines;
      }
      case "script":
      case "style":
      case "noscript":
        return [];
      default: {
        const childBlocks = el.childNodes.filter((n) => n instanceof HTMLElement);
        if (childBlocks.length > 0) {
          return childBlocks.flatMap((n) => block(n as HTMLElement));
        }
        const t = inline(el).trim();
        return t ? [t] : [];
      }
    }
  }

  const body = root.querySelector("body") ?? root;
  const lines = block(body);
  // 合并相邻文本块、压缩超过两个的连续空行
  return lines.join("\n\n").replace(/\n{4,}/g, "\n\n\n").trim();
}

// ── CSV / JSON ─────────────────────────────────────────────

function parseCsv(csv: string, name: string): { rows: Record<string, string>[]; fields: string[] } {
  const ext = getExtension(name);
  const result = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    delimiter: ext === "tsv" ? "\t" : "",
  });
  if (result.errors.length > 0) {
    const first = result.errors[0];
    throw new AppError(
      `解析「${name}」失败：第 ${first.row ?? "?"} 行 ${first.message}`,
      422,
      "CSV_PARSE_FAILED",
    );
  }
  return { rows: result.data, fields: result.meta.fields ?? [] };
}

export function csvToJson(csv: string, name: string): string {
  const { rows } = parseCsv(csv, name);
  return JSON.stringify(rows, null, 2);
}

export function csvToMarkdown(csv: string, name: string): string {
  const { rows, fields } = parseCsv(csv, name);
  if (fields.length === 0) return "";
  const cell = (v: unknown) => String(v ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
  const lines = [
    `| ${fields.map(cell).join(" | ")} |`,
    `| ${fields.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${fields.map((f) => cell(r[f])).join(" | ")} |`),
  ];
  return lines.join("\n");
}

export function csvToHtml(csv: string, name: string): string {
  const { rows, fields } = parseCsv(csv, name);
  const head = fields.map((f) => `<th>${escapeHtml(f)}</th>`).join("");
  const body = rows
    .map((r) => `<tr>${fields.map((f) => `<td>${escapeHtml(String(r[f] ?? ""))}</td>`).join("")}</tr>`)
    .join("\n");
  return htmlDocument(
    name,
    `<table>\n<thead><tr>${head}</tr></thead>\n<tbody>\n${body}\n</tbody>\n</table>`,
  );
}

export function jsonToCsv(jsonText: string, name: string): string {
  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch (err) {
    throw new AppError(`「${name}」不是有效的 JSON：${String(err instanceof Error ? err.message : err)}`, 422, "JSON_PARSE_FAILED");
  }
  if (!Array.isArray(data)) {
    throw new AppError("转换为 CSV 需要 JSON 顶层为数组（对象数组）", 422, "JSON_NOT_ARRAY");
  }
  if (data.length === 0) return "";
  const rows = data.map((item) => {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      throw new AppError("JSON 数组的每一项都需要是对象（键值对）", 422, "JSON_ITEM_NOT_OBJECT");
    }
    const row: Record<string, string> = {};
    for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
      row[k] =
        v === null || v === undefined
          ? ""
          : typeof v === "object"
            ? JSON.stringify(v)
            : String(v);
    }
    return row;
  });
  return Papa.unparse(rows);
}

// ── DOCX 生成 ──────────────────────────────────────────────

const HEADINGS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
];

/** 将 Markdown 逐行解析为 Word 段落（标题 / 列表 / 引用 / 普通段落） */
export function markdownToDocxParagraphs(md: string): Paragraph[] {
  const paras: Paragraph[] = [];
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      paras.push(
        new Paragraph({ text: heading[2].trim(), heading: HEADINGS[heading[1].length - 1] }),
      );
      continue;
    }
    const bullet = /^[-*+]\s+(.*)$/.exec(line);
    if (bullet) {
      paras.push(new Paragraph({ text: bullet[1].trim(), bullet: { level: 0 } }));
      continue;
    }
    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      paras.push(
        new Paragraph({
          children: [new TextRun(quote[1].trim())],
          indent: { left: 720 },
        }),
      );
      continue;
    }
    paras.push(new Paragraph({ children: [new TextRun(line)] }));
  }
  return paras;
}

export async function textToDocx(text: string): Promise<Buffer> {
  const paragraphs = normalizeText(text)
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => new Paragraph({ children: [new TextRun(l)] }));
  const doc = new Document({
    creator: "AnythingBox",
    title: "Converted document",
    sections: [{ children: paragraphs.length ? paragraphs : [new Paragraph("")] }],
  });
  return Packer.toBuffer(doc);
}

export async function markdownToDocx(md: string): Promise<Buffer> {
  const doc = new Document({
    creator: "AnythingBox",
    title: "Converted document",
    sections: [{ children: markdownToDocxParagraphs(md) }],
  });
  return Packer.toBuffer(doc);
}

// ── PDF 生成（内置西文字体） ───────────────────────────────

// PDF 标准字体使用 WinAnsi 编码，无法编码中文等字符；先做保守检测，给出明确错误而不是生成乱码
const WINANSI_EXTRA = /[\u0152\u0153\u0160\u0161\u0178\u017D\u017E\u0192\u2013\u2014\u2018\u2019\u201A\u201C\u201D\u201E\u2020\u2021\u2022\u2026\u2030\u2039\u203A\u20AC\u2122]/;
const NON_WINANSI = /[^\u0000-\u00ff]/;

function assertPdfEncodable(text: string): void {
  const nonLatin = text.replace(WINANSI_EXTRA, "");
  if (NON_WINANSI.test(nonLatin)) {
    throw new AppError(
      "导出 PDF 目前仅支持西文内容（受 PDF 内置字体限制）。包含中文等字符的文档请选择 Word 或 HTML 格式。",
      422,
      "PDF_FONT_LIMIT",
    );
  }
}

function wrapPdfLine(line: string, font: import("pdf-lib").PDFFont, size: number, maxWidth: number): string[] {
  if (!line) return [""];
  const out: string[] = [];
  let current = "";
  const words = line.split(" ");
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) out.push(current);
    // 单个词超宽时按字符硬折行
    if (font.widthOfTextAtSize(word, size) > maxWidth) {
      let chunk = "";
      for (const ch of word) {
        if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth) {
          out.push(chunk);
          chunk = ch;
        } else {
          chunk += ch;
        }
      }
      current = chunk;
    } else {
      current = word;
    }
  }
  if (current) out.push(current);
  return out;
}

export async function textToPdf(text: string, title: string): Promise<Buffer> {
  const normalized = normalizeText(text);
  assertPdfEncodable(normalized);
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontSize = 11;
  const lineHeight = fontSize * 1.55;
  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const margin = 56;
  const maxWidth = pageWidth - margin * 2;

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;
  const drawLine = (seg: string) => {
    if (y - fontSize < margin) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    if (seg) {
      page.drawText(seg, { x: margin, y: y - fontSize, size: fontSize, font, color: rgb(0.11, 0.1, 0.11) });
    }
    y -= lineHeight;
  };
  for (const rawLine of normalized.split("\n")) {
    for (const seg of wrapPdfLine(rawLine, font, fontSize, maxWidth)) {
      drawLine(seg);
    }
  }
  return Buffer.from(await pdf.save());
}

// ── DOCX 读取（mammoth） ───────────────────────────────────

async function withMammoth<T>(name: string, fn: () => Promise<{ value: T; messages: unknown[] }>): Promise<T> {
  try {
    const { value } = await fn();
    return value;
  } catch {
    throw new AppError(
      `无法读取 Word 文档「${name}」，文件可能不是有效的 .docx（旧版 .doc 请先另存为 .docx）`,
      422,
      "DOCX_READ_FAILED",
    );
  }
}

// ── 转换入口 ───────────────────────────────────────────────

export async function convertFile(
  kind: FileKind,
  target: TargetFormat,
  buffer: Buffer,
  name: string,
): Promise<ConvertOutput> {
  const allowed = CONVERSION_MATRIX[kind] ?? [];
  if (!allowed.includes(target)) {
    throw new AppError(
      `不支持将${KIND_LABEL[kind]}文件转换为 ${FORMATS[target]?.label ?? target}`,
      400,
      "UNSUPPORTED_CONVERSION",
    );
  }
  const key = `${kind}->${target}`;
  let data: Buffer;
  switch (key) {
    // 文本 →
    case "text->md":
      data = Buffer.from(normalizeText(decodeText(buffer)), "utf8");
      break;
    case "text->html": {
      const text = normalizeText(decodeText(buffer));
      const body = text
        .split(/\n{2,}/)
        .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
        .join("\n");
      data = Buffer.from(htmlDocument(name, body), "utf8");
      break;
    }
    case "text->docx":
      data = await textToDocx(decodeText(buffer));
      break;
    case "text->pdf":
      data = await textToPdf(decodeText(buffer), name);
      break;

    // Markdown →
    case "markdown->txt":
      data = Buffer.from(await markdownToText(decodeText(buffer)), "utf8");
      break;
    case "markdown->html":
      data = Buffer.from(htmlDocument(name, await markdownToHtmlBody(decodeText(buffer))), "utf8");
      break;
    case "markdown->docx":
      data = await markdownToDocx(decodeText(buffer));
      break;
    case "markdown->pdf":
      data = await textToPdf(await markdownToText(decodeText(buffer)), name);
      break;

    // HTML →
    case "html->txt":
      data = Buffer.from(collapseWhitespace(htmlToPlainText(decodeText(buffer))), "utf8");
      break;
    case "html->md":
      data = Buffer.from(htmlToMarkdown(decodeText(buffer)), "utf8");
      break;

    // CSV →
    case "csv->json":
      data = Buffer.from(csvToJson(decodeText(buffer), name), "utf8");
      break;
    case "csv->md":
      data = Buffer.from(csvToMarkdown(decodeText(buffer), name), "utf8");
      break;
    case "csv->html":
      data = Buffer.from(csvToHtml(decodeText(buffer), name), "utf8");
      break;

    // JSON →
    case "json->csv":
      data = Buffer.from(jsonToCsv(decodeText(buffer), name), "utf8");
      break;

    // PDF →（文本提取）
    case "pdf->txt": {
      const { text } = await extractTextFromFile(buffer, "pdf", name);
      data = Buffer.from(text, "utf8");
      break;
    }
    case "pdf->md": {
      const { text } = await extractTextFromFile(buffer, "pdf", name);
      data = Buffer.from(text, "utf8");
      break;
    }

    // Word →
    case "docx->txt": {
      const value = await withMammoth(name, () => mammoth.extractRawText({ buffer }));
      data = Buffer.from(collapseWhitespace(value), "utf8");
      break;
    }
    case "docx->md": {
      const html = await withMammoth(name, () => mammoth.convertToHtml({ buffer }));
      data = Buffer.from(htmlToMarkdown(html).trim(), "utf8");
      break;
    }
    case "docx->html": {
      const value = await withMammoth(name, () => mammoth.convertToHtml({ buffer }));
      data = Buffer.from(htmlDocument(name, value), "utf8");
      break;
    }

    default:
      throw new AppError(`该转换尚未实现：${key}`, 400, "UNSUPPORTED_CONVERSION");
  }
  return { data, mimeType: RESULT_MIME[target], ext: FORMATS[target].ext };
}
