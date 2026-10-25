import { parse as parseHtml } from "node-html-parser";
import mammoth from "mammoth";
import { extractText as unpdfExtractText, getDocumentProxy } from "unpdf";
import { AppError } from "./errors";
import { createLogger } from "./logger";
import type { FileKind } from "./types";

const log = createLogger("extract");

export interface ExtractResult {
  text: string;
  pages?: number;
}

export function decodeText(buffer: Buffer): string {
  return buffer.toString("utf8").replace(/^\uFEFF/, "");
}

/** 压缩 HTML 提取文本中过量的空白（保留段落结构） */
export function collapseWhitespace(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function htmlToPlainText(html: string): string {
  const root = parseHtml(html);
  // 移除脚本与样式内容
  root.querySelectorAll("script,style,noscript").forEach((el) => el.remove());
  return collapseWhitespace(root.structuredText ?? root.text ?? "");
}

/**
 * 从受支持的文件中提取纯文本。
 * 图片不属于“直接可提取”的类别，需要走 OCR 流程。
 */
export async function extractTextFromFile(
  buffer: Buffer,
  kind: FileKind,
  name: string,
): Promise<ExtractResult> {
  switch (kind) {
    case "text":
    case "markdown":
    case "csv":
    case "json":
      return { text: decodeText(buffer) };

    case "html":
      return { text: htmlToPlainText(decodeText(buffer)) };

    case "pdf": {
      try {
        const pdf = await getDocumentProxy(new Uint8Array(buffer));
        const { totalPages, text } = await unpdfExtractText(pdf, { mergePages: true });
        return { text: collapseWhitespace(text), pages: totalPages };
      } catch (err) {
        log.warn("PDF 文本提取失败", { name, err: String(err) });
        throw new AppError(
          `无法从 PDF「${name}」中提取文本，文件可能已加密或已损坏`,
          422,
          "PDF_EXTRACT_FAILED",
        );
      }
    }

    case "docx": {
      try {
        const { value } = await mammoth.extractRawText({ buffer });
        return { text: collapseWhitespace(value) };
      } catch (err) {
        log.warn("DOCX 文本提取失败", { name, err: String(err) });
        throw new AppError(
          `无法读取 Word 文档「${name}」，文件可能不是有效的 .docx（旧版 .doc 请先另存为 .docx）`,
          422,
          "DOCX_EXTRACT_FAILED",
        );
      }
    }

    case "image":
      throw new AppError(
        `「${name}」是图片文件，请使用“OCR 文字识别”操作提取文字`,
        400,
        "USE_OCR",
      );

    default:
      throw new AppError(`不支持的文件类别：${kind}`, 400, "UNSUPPORTED_KIND");
  }
}
