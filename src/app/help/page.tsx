import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CircleHelp, Download, FileQuestion, ShieldCheck, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = {
  title: "帮助",
};

const FORMAT_MATRIX: { ext: string; name: string; targets: string }[] = [
  { ext: ".txt / .log", name: "纯文本", targets: "Markdown、HTML、Word、PDF" },
  { ext: ".md / .markdown", name: "Markdown", targets: "纯文本、HTML、Word、PDF" },
  { ext: ".html / .htm", name: "网页", targets: "纯文本、Markdown" },
  { ext: ".csv / .tsv", name: "表格", targets: "JSON、Markdown 表格、HTML 表格" },
  { ext: ".json", name: "JSON", targets: "CSV（对象数组）" },
  { ext: ".pdf", name: "PDF", targets: "纯文本、Markdown（可提取文本的 PDF）" },
  { ext: ".docx", name: "Word", targets: "纯文本、Markdown、HTML" },
  { ext: ".png / .jpg / .webp / .bmp / .tif", name: "图片", targets: "OCR 识别为纯文本" },
];

const FAQ = [
  {
    q: "AI 功能必须配置吗？",
    a: "不必须。提取文本、格式转换、OCR 全部在本地完成，不配置 AI 也能正常使用。只有 AI 总结、重点提取、文档问答需要在 .env 中配置你自己的模型接口。",
  },
  {
    q: "我的文件会被上传到第三方吗？",
    a: "不会。文件保存在你自己运行应用的服务器上（.data 目录）。只有在你主动配置 AI 并执行 AI 分析时，选中文档的文本内容才会发送给你指定的 AI_BASE_URL。",
  },
  {
    q: "PDF 转换失败了怎么办？",
    a: "扫描版 PDF（内容是图片）没有可提取的文字层，无法直接提取文本。可尝试使用带 OCR 的工具先做文字层识别。加密 PDF 也无法处理。",
  },
  {
    q: "导出 PDF 提示“仅支持西文内容”？",
    a: "服务端 PDF 生成使用内置西文字体，暂不支持中文字符嵌入。包含中文的内容请导出为 Word 或 HTML 格式。",
  },
  {
    q: "上传的文件会被自动删除吗？",
    a: "不会自动删除。你可以在工作台删除单个文件，或在设置页清空全部数据。",
  },
  {
    q: "支持哪些部署方式？",
    a: "本地 Node.js 运行、Docker 或 Vercel。注意：Vercel 等无持久磁盘的平台重启后数据会丢失，生产持久使用建议自托管或挂载持久卷。",
  },
];

export default function HelpPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">帮助中心</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          五分钟上手 AnythingBox，了解每个功能的边界与最佳实践。
        </p>
      </div>

      {/* 快速开始 */}
      <Card className="mb-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Workflow className="size-4 text-primary" aria-hidden />
            快速开始
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>
              打开<Link href="/workspace" className="mx-1 font-medium text-primary">工作台</Link>
              ，把文件拖进虚线框（或点击选择），支持一次多选。
            </li>
            <li>在右侧「处理操作」中选定操作类型：提取文本、格式转换、OCR 或 AI 分析。</li>
            <li>勾选一个或多个文件（批量处理时对每个文件执行同一操作），点击「开始处理」。</li>
            <li>在结果区逐个下载，或一键打包为 ZIP；全部任务可在「任务记录」中回看。</li>
          </ol>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href="/workspace">
              打开工作台
              <ArrowRight className="ml-1 size-3.5" aria-hidden />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* 支持的格式 */}
      <Card className="mb-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="size-4 text-primary" aria-hidden />
            支持的输入格式与可转换目标
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">扩展名</TableHead>
                <TableHead>类型</TableHead>
                <TableHead className="pr-6">可转换 / 输出目标</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {FORMAT_MATRIX.map((row) => (
                <TableRow key={row.ext}>
                  <TableCell className="pl-6 font-mono text-xs">{row.ext}</TableCell>
                  <TableCell className="text-sm">{row.name}</TableCell>
                  <TableCell className="pr-6 text-sm text-muted-foreground">{row.targets}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="px-6 pt-3 text-xs leading-relaxed text-muted-foreground">
            所有转换都基于真实内容解析与生成（例如 Markdown 转 Word 会解析标题与列表结构），
            不存在仅修改扩展名的“假转换”。
          </p>
        </CardContent>
      </Card>

      {/* 隐私说明 */}
      <Card className="mb-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4 text-primary" aria-hidden />
            数据与隐私
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm leading-relaxed text-muted-foreground">
          <p>
            本地处理：文件存储、格式转换、文本提取、OCR 均在你的服务器上完成，不经过任何第三方。
          </p>
          <p>
            AI 分析：当你配置 AI 服务并执行 AI 操作时，所选文件提取出的文本会发送到你配置的
            <code className="mx-1 font-mono text-xs">AI_BASE_URL</code>。
            API 密钥仅保存在服务端环境变量中，不会出现在浏览器或下载文件里。
          </p>
          <p>
            文件删除：工作台支持删除单个文件；设置页可一键清空全部数据。删除是物理删除，不进回收站。
          </p>
        </CardContent>
      </Card>

      {/* FAQ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileQuestion className="size-4 text-primary" aria-hidden />
            常见问题
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {FAQ.map((item) => (
            <details key={item.q} className="group border-b border-border/60 last:border-0">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2">
                  <CircleHelp className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  {item.q}
                </span>
                <span className="text-muted-foreground transition-transform group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="pb-4 pl-6 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
