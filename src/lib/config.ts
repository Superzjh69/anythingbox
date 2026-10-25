import { z } from "zod";

const EnvSchema = z.object({
  /** OpenAI 兼容接口地址，例如 https://api.openai.com/v1 */
  AI_BASE_URL: z.string().trim().default("https://api.openai.com/v1"),
  AI_API_KEY: z.string().trim().default(""),
  AI_MODEL: z.string().trim().default("gpt-4o-mini"),
  AI_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(300_000).default(60_000),
  MAX_FILE_SIZE_MB: z.coerce.number().min(1).max(200).default(20),
  MAX_FILES_PER_UPLOAD: z.coerce.number().int().min(1).max(50).default(20),
  DATA_DIR: z.string().trim().default(".data"),
});

export interface AppConfig {
  aiBaseUrl: string;
  aiApiKey: string;
  aiModel: string;
  aiTimeoutMs: number;
  aiConfigured: boolean;
  maxFileSizeBytes: number;
  maxFilesPerUpload: number;
  dataDir: string;
}

let cached: AppConfig | null = null;

/** 读取并校验环境变量配置（服务端专用，密钥不会传给前端） */
export function getConfig(): AppConfig {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  const env = parsed.success ? parsed.data : EnvSchema.parse({});
  if (!parsed.success) {
    // 单个变量非法时回退默认值，而不是让整个应用崩溃
    console.warn(
      "[AnythingBox] 部分环境变量无效，已使用默认值：",
      parsed.error.issues.map((i) => i.path.join(".")).join(", "),
    );
  }
  cached = {
    aiBaseUrl: env.AI_BASE_URL.replace(/\/+$/, ""),
    aiApiKey: env.AI_API_KEY,
    aiModel: env.AI_MODEL,
    aiTimeoutMs: env.AI_TIMEOUT_MS,
    aiConfigured: Boolean(env.AI_API_KEY && env.AI_BASE_URL),
    maxFileSizeBytes: Math.round(env.MAX_FILE_SIZE_MB * 1024 * 1024),
    maxFilesPerUpload: env.MAX_FILES_PER_UPLOAD,
    dataDir: env.DATA_DIR,
  };
  return cached;
}

/** 仅供测试使用：清除配置缓存以便重新读取环境变量 */
export function resetConfigCache(): void {
  cached = null;
}
