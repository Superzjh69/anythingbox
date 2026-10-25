import Link from "next/link";
import {
  ArrowRight,
  FileText,
  FileType2,
  ScanText,
  Sparkles,
  Table2,
  ShieldCheck,
  Boxes,
  FolderDown,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const FEATURES = [
  {
    icon: FileType2,
    title: "真实格式转换",
    desc: "Markdown、HTML、Word、PDF、CSV、JSON 之间真实互转，基于内容解析生成，而非改扩展名。",
  },
  {
    icon: FileText,
    title: "文本与表格提取",
    desc: "从 PDF、Word、网页与表格文件中提取干净可用的纯文本，支持批量处理。",
  },
  {
    icon: ScanText,
    title: "图片 OCR",
    desc: "内置 Tesseract 识别引擎，把截图与扫描件中的文字变成可编辑文本。",
  },
  {
    icon: Sparkles,
    title: "AI 文档分析",
    desc: "接入任意 OpenAI 兼容接口，一键完成文档总结、重点提取与文档问答。",
  },
  {
    icon: Layers,
    title: "批量工作流",
    desc: "勾选多个文件执行同一操作，逐文件报告成功与失败，结果一键打包下载。",
  },
  {
    icon: FolderDown,
    title: "任务可追溯",
    desc: "每次处理都有完整记录：状态、耗时、输入文件与失败原因，随时回看与下载。",
  },
];

const STEPS = [
  { n: "01", title: "上传文件", desc: "拖拽或选择文件，支持 TXT、Markdown、PDF、Word、CSV、JSON、HTML 与常见图片。" },
  { n: "02", title: "选择操作", desc: "提取文本、格式转换、OCR 或 AI 分析；操作面板只展示当前文件真正支持的能力。" },
  { n: "03", title: "下载结果", desc: "处理结果可直接下载，多文件结果自动打包为 ZIP。" },
];

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="secondary" className="mb-5 gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
            <ShieldCheck className="size-3.5" aria-hidden />
            文件留在本地处理，AI 仅在你配置后才启用
          </Badge>
          <h1 className="text-balance text-4xl font-semibold leading-[1.15] tracking-tight sm:text-5xl">
            把重复的文件处理
            <br />
            交给一个可靠的工作台
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            AnythingBox 是一个开源的 AI 文件处理 Web 应用：转换格式、提取文本、识别图片文字、总结长文档，
            全部在一个界面完成。
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-11 px-6 text-[15px]">
              <Link href="/workspace">
                打开工作台
                <ArrowRight className="ml-1 size-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-11 px-6 text-[15px]">
              <Link href="/help">查看使用说明</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            无需注册 · 无需数据库 · 支持自托管部署
          </p>
        </div>

        {/* 产品示意 */}
        <div className="mx-auto mt-14 max-w-4xl overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="flex items-center gap-1.5 border-b border-border/70 bg-muted/50 px-4 py-2.5">
            <span className="size-2.5 rounded-full bg-border" />
            <span className="size-2.5 rounded-full bg-border" />
            <span className="size-2.5 rounded-full bg-border" />
            <span className="ml-3 text-xs text-muted-foreground">anythingbox / 工作台</span>
          </div>
          <div className="grid gap-px bg-border/60 sm:grid-cols-[1.2fr_1fr]">
            <div className="space-y-3 bg-card p-6">
              <div className="rounded-lg border border-dashed border-border/80 p-6 text-center">
                <Boxes className="mx-auto mb-2 size-6 text-muted-foreground" aria-hidden />
                <p className="text-sm text-muted-foreground">拖拽文件到此处，或点击选择</p>
              </div>
              {["季度报告.pdf", "会议纪要.docx", "数据明细.csv"].map((name, i) => (
                <div
                  key={name}
                  className="flex items-center justify-between rounded-lg border border-border/70 bg-background px-3.5 py-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <FileText className="size-4 text-muted-foreground" aria-hidden />
                    <span className="text-sm">{name}</span>
                  </div>
                  <Badge variant={i === 2 ? "secondary" : "default"} className="text-[11px]">
                    {i === 2 ? "待处理" : "已完成"}
                  </Badge>
                </div>
              ))}
            </div>
            <div className="space-y-4 bg-card p-6">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">处理操作</p>
              {["提取文本", "转换为 Word", "AI 文档总结"].map((op, i) => (
                <div
                  key={op}
                  className={`rounded-lg border px-3.5 py-2.5 text-sm ${
                    i === 1 ? "border-primary/50 bg-primary/5 font-medium text-foreground" : "border-border/70 text-muted-foreground"
                  }`}
                >
                  {op}
                </div>
              ))}
              <div className="rounded-lg bg-primary px-3.5 py-2.5 text-center text-sm font-medium text-primary-foreground">
                开始处理（2 个文件）
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 功能 */}
      <section className="border-t border-border/70 bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <div className="max-w-xl">
            <h2 className="text-2xl font-semibold tracking-tight">一个界面，覆盖常见文件处理</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              每个功能都是真实实现：转换基于内容解析，OCR 使用本地引擎，AI 通过你自己的接口调用。
            </p>
          </div>
          <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border/70 bg-border/60 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-card p-6 transition-colors hover:bg-accent/40">
                <f.icon className="size-5 text-primary" aria-hidden />
                <h3 className="mt-3.5 text-[15px] font-medium">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 使用步骤 */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">三步完成一次处理</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              没有复杂的配置向导。打开工作台，拖入文件，点击开始。
            </p>
            <Button asChild variant="outline" className="mt-6">
              <Link href="/workspace">
                立即体验
                <ArrowRight className="ml-1 size-4" aria-hidden />
              </Link>
            </Button>
          </div>
          <ol className="space-y-3">
            {STEPS.map((s) => (
              <li
                key={s.n}
                className="flex gap-5 rounded-xl border border-border/70 bg-card p-5"
              >
                <span className="text-sm font-semibold tabular-nums text-primary">{s.n}</span>
                <div>
                  <h3 className="text-[15px] font-medium">{s.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 隐私 */}
      <section className="border-t border-border/70">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-4 py-14 sm:px-6 lg:flex-row lg:items-center">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <ShieldCheck className="size-5 text-primary" aria-hidden />
          </div>
          <div className="max-w-2xl">
            <h2 className="text-xl font-semibold tracking-tight">本地优先的隐私设计</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              文件上传、格式转换、文本提取与 OCR 全部在你的服务器上完成，不经过任何第三方。
              只有当你在设置中主动配置 AI 接口后，选中文档的文本内容才会发送给你指定的服务地址。
              不配置 AI 也能使用全部本地功能。
            </p>
          </div>
          <div className="lg:ml-auto">
            <Button asChild variant="ghost" className="text-primary hover:text-primary">
              <Link href="/settings">
                查看隐私说明
                <ArrowRight className="ml-1 size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/70 bg-muted/30">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 py-16 text-center sm:px-6">
          <Table2 className="mb-4 size-6 text-primary" aria-hidden />
          <h2 className="text-2xl font-semibold tracking-tight">准备好处理你的文件了吗？</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            打开工作台，拖入第一批文件，看看 AnythingBox 能帮你节省多少时间。
          </p>
          <Button asChild size="lg" className="mt-6 h-11 px-6 text-[15px]">
            <Link href="/workspace">
              打开工作台
              <ArrowRight className="ml-1 size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
