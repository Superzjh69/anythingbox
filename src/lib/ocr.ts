import { createWorker } from "tesseract.js";
import { AppError } from "./errors";
import { createLogger } from "./logger";

const log = createLogger("ocr");

/**
 * 使用 Tesseract.js 对图片执行 OCR。
 * 注意：首次运行会从网络下载语言模型（eng.traineddata），
 * 离线环境下会给出明确错误提示。
 */
export async function ocrImage(buffer: Buffer, name: string): Promise<string> {
  let worker: Awaited<ReturnType<typeof createWorker>>;
  try {
    worker = await createWorker("eng");
  } catch (err) {
    log.warn("OCR 初始化失败", { name, err: String(err) });
    throw new AppError(
      "OCR 引擎初始化失败：首次使用需要联网下载语言模型，请检查网络后重试",
      502,
      "OCR_INIT_FAILED",
    );
  }
  try {
    const { data } = await worker.recognize(buffer);
    const text = (data.text ?? "").trim();
    if (!text) {
      throw new AppError(
        `未能从图片「${name}」中识别出文字，请确认图片清晰且包含印刷体文本`,
        422,
        "OCR_EMPTY",
      );
    }
    return text;
  } catch (err) {
    if (err instanceof AppError) throw err;
    log.warn("OCR 识别失败", { name, err: String(err) });
    throw new AppError(`图片「${name}」OCR 识别失败：${String(err)}`, 422, "OCR_FAILED");
  } finally {
    try {
      await worker.terminate();
    } catch {
      // 终止失败不影响主流程
    }
  }
}
