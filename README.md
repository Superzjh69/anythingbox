# AnythingBox

**本地优先的 AI 文件处理工作台。** 上传文件，一步完成格式转换、文本提取、OCR 识别与 AI 文档分析。

![Next.js](https://img.shields.io/badge/Next.js-15-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Test](https://img.shields.io/badge/tests-Vitest%20%2B%20Playwright-green) ![License](https://img.shields.io/badge/license-MIT-lightgrey)

## 功能

- **文件上传** — 拖拽 / 多选上传，进度显示，类型与大小校验，单文件删除，内容预览（CSV 以表格预览）
- **真实格式转换** — Markdown ↔ HTML / Word / 纯文本，CSV ↔ JSON / Markdown 表格 / HTML 表格，Word → Markdown / HTML / 纯文本，PDF → 文本。全部基于内容解析生成，不存在只改扩展名的“假转换”
- **文本提取** — PDF、Word、网页、表格文件提取干净文本
- **图片 OCR** — 内置 Tesseract 引擎（首次使用需联网下载语言模型）
- **AI 文档分析** — 兼容 OpenAI Chat Completions 的任意服务（OpenAI / DeepSeek / Ollama / LM Studio 等），支持文档总结、重点提取、文档问答
- **批量处理** — 勾选多个文件执行同一操作，逐文件报告成功 / 失败，互不影响
- **任务记录** — 状态、耗时、输入文件、失败原因、AI 输出，完整可追溯
- **结果下载** — 单个下载或多结果打包 ZIP

**不配置 AI 也能使用全部本地功能**（上传 / 转换 / 提取 / OCR）。

## 快速开始

```bash
# 1. 安装依赖（Node.js ≥ 20）
npm install

# 2. 配置环境变量（AI 可选）
cp .env.example .env        # Windows: copy .env.example .env

# 3. 启动开发服务器
npm run dev
```

打开 <http://localhost:3000>，进入「工作台」即可上传文件。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `AI_API_KEY` | 空 | AI 服务密钥，留空则禁用 AI 功能 |
| `AI_BASE_URL` | `https://api.openai.com/v1` | OpenAI 兼容接口地址 |
| `AI_MODEL` | `gpt-4o-mini` | 模型名称 |
| `AI_TIMEOUT_MS` | `60000` | AI 请求超时（毫秒） |
| `MAX_FILE_SIZE_MB` | `20` | 单文件大小上限（MB） |
| `MAX_FILES_PER_UPLOAD` | `20` | 单次上传数量上限 |
| `DATA_DIR` | `.data` | 数据目录（uploads / results / meta） |

密钥仅保存在服务端环境变量中，永远不会发送到浏览器。

## 测试

```bash
npm run typecheck   # TypeScript 类型检查
npm run lint        # ESLint
npm test            # Vitest 单元 / 集成测试（49 项）
npm run test:e2e    # Playwright 端到端测试（需先构建并启动）
```

端到端测试默认使用系统 Microsoft Edge（`channel: "msedge"`），无需额外下载浏览器。

## 部署

### 本地 / 自托管（推荐）

```bash
npm run build
npm run start       # 默认 3000 端口，可用 PORT=8080 指定
```

数据保存在 `DATA_DIR` 目录，记得纳入备份。

### Docker

```bash
docker build -t anythingbox .
docker run -p 3000:3000 -v anythingbox-data:/app/.data --env-file .env anythingbox
```

### Vercel

1. 推送到 GitHub 后在 [vercel.com](https://vercel.com) 导入仓库；
2. 在项目 Settings → Environment Variables 中配置 `AI_API_KEY`（可选）及其他变量；
3. Deploy。

> ⚠️ Vercel 无持久磁盘：上传的文件与任务记录在实例重启后会丢失，且 serverless 函数有请求时长限制（AI / OCR 大任务可能超时）。持久使用请选择自托管。

## 隐私模型

| 数据 | 处理位置 |
| --- | --- |
| 文件存储、格式转换、文本提取、OCR | 全部在你的服务器本地，不经过第三方 |
| AI 总结 / 提取 / 问答 | 仅在你配置后，把选中文档的**文本内容**发送到你指定的 `AI_BASE_URL` |

## 目录结构

```
src/
  app/
    page.tsx              首页
    workspace/            文件工作台
    tasks/                任务记录
    settings/             设置（AI 状态 / 限额 / 隐私说明 / 清空数据）
    help/                 帮助中心
    api/
      files/              上传、列表、删除、预览
      process/            批处理任务入口
      tasks/              任务记录
      results/            结果列表
      download/           结果 / ZIP 下载
      config/             公共配置与数据清空
      health/             健康检查
  components/             页面组件 + shadcn/ui 基础组件
  lib/
    storage.ts            文件系统存储（JSON 元数据 + blob）
    extract.ts            文本提取（PDF / Word / HTML / 表格）
    convert.ts            真实格式转换引擎
    ocr.ts                Tesseract OCR
    ai.ts                 OpenAI 兼容 AI 客户端
    engine.ts             批处理任务引擎
    config.ts             Zod 校验的环境配置
tests/                    Vitest 测试
e2e/                      Playwright 测试
```

## 技术栈

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui · Zod · Lucide · unpdf · mammoth · pdf-lib · docx · PapaParse · marked · node-html-parser · tesseract.js · JSZip · Vitest · Playwright

## License

[MIT](./LICENSE)
