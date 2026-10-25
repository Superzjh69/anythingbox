import { AppError } from "./errors";
import { createLogger } from "./logger";

const log = createLogger("ai");

export type AiPromptAction = "summarize" | "keypoints" | "ask";

const SYSTEM_PROMPTS: Record<AiPromptAction, string> = {
  summarize:
    "你是专业的文档分析助手。请用简体中文对用户提供的文档内容进行总结：先用一句话概括核心主题，再用 3-6 个要点展开关键内容。不要编造文档中不存在的信息。",
  keypoints:
    "你是专业的文档分析助手。请从用户提供的文档中提取最重要的关键信息，用简体中文以编号列表输出：包括核心结论、关键数据、行动项与需要注意的风险。只依据文档内容，不要编造。",
  ask: "你是专业的文档问答助手。请仅依据用户提供的文档内容回答问题，用简体中文作答。如果文档中没有足够信息，请明确说明无法从文档中得出答案。",
};

export interface AiOptions {
  action: AiPromptAction;
  question?: string;
  documentTitle: string;
  documentText: string;
}

function buildUserContent(opts: AiOptions): string {
  const doc = opts.documentText;
  const header = `文档标题：${opts.documentTitle}\n以下是需要分析的文档内容（纯文本）：\n\n`;
  return `${header}${doc}\n\n${
    opts.action === "ask" ? `用户问题：${opts.question ?? ""}` : "请按要求处理以上文档。"
  }`;
}

export interface AiCallResult {
  output: string;
  model: string;
}

/** 调用 OpenAI 兼容 chat/completions 接口，带超时与明确错误分类 */
export async function callAi(opts: AiOptions): Promise<AiCallResult> {
  const { getConfig } = await import("./config");
  const cfg = getConfig();
  if (!cfg.aiConfigured) {
    throw new AppError(
      "AI 服务尚未配置：请在项目根目录的 .env 中设置 AI_API_KEY（与 AI_BASE_URL、AI_MODEL 可选）后重启应用",
      503,
      "AI_NOT_CONFIGURED",
    );
  }
  if (opts.documentText.trim().length === 0) {
    throw new AppError("文档内容为空，无法进行 AI 分析", 422, "EMPTY_CONTENT");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.aiTimeoutMs);
  const url = `${cfg.aiBaseUrl}/chat/completions`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.aiApiKey}`,
      },
      body: JSON.stringify({
        model: cfg.aiModel,
        messages: [
          { role: "system", content: SYSTEM_PROMPTS[opts.action] },
          { role: "user", content: buildUserContent(opts) },
        ],
        temperature: 0.3,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      let detail = "";
      try {
        const body = (await res.json()) as { error?: { message?: string } };
        detail = body?.error?.message ?? "";
      } catch {
        detail = await res.text().catch(() => "");
      }
      log.warn("AI 接口返回错误", { status: res.status, detail: detail.slice(0, 300) });
      const hint =
        res.status === 401
          ? "API 密钥无效或已过期"
          : res.status === 404
            ? "接口地址或模型名称不正确"
            : res.status === 429
              ? "请求过于频繁或额度不足"
              : "上游服务返回错误";
      throw new AppError(`AI 服务请求失败（HTTP ${res.status}）：${hint}${detail ? `，${detail}` : ""}`, 502, "AI_UPSTREAM");
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
    };
    const output = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!output) {
      throw new AppError("AI 服务返回了空内容，请稍后重试或更换模型", 502, "AI_EMPTY");
    }
    return { output, model: data.model ?? cfg.aiModel };
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new AppError(
        `AI 请求超时（${Math.round(cfg.aiTimeoutMs / 1000)} 秒），可在 .env 中调大 AI_TIMEOUT_MS`,
        504,
        "AI_TIMEOUT",
      );
    }
    log.warn("AI 网络请求异常", { err: String(err) });
    throw new AppError("无法连接 AI 服务，请检查 AI_BASE_URL 与网络设置", 502, "AI_NETWORK");
  } finally {
    clearTimeout(timer);
  }
}
