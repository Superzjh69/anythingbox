"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  Database,
  Loader2,
  Lock,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { clearAllData, fetchConfig } from "@/lib/client/api";
import { formatBytes } from "@/lib/file-utils";
import type { PublicConfig, Stats } from "@/lib/client/api";

export function SettingsClient() {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchConfig();
      setConfig(data.config);
      setStats(data.stats);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "加载配置失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleReset = async () => {
    setConfirmReset(false);
    setResetting(true);
    try {
      await clearAllData();
      await refresh();
      toast.success("已清空全部数据");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "清空失败");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">设置</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          AI 服务通过环境变量在服务端配置，密钥永远不会下发到浏览器。
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          正在加载…
        </div>
      ) : config ? (
        <div className="space-y-5">
          {/* AI 服务状态 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4 text-primary" aria-hidden />
                AI 服务
              </CardTitle>
              <CardDescription>
                兼容 OpenAI Chat Completions 接口（OpenAI、Azure OpenAI、DeepSeek、Ollama、LM Studio 等）
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">配置状态</span>
                {config.aiConfigured ? (
                  <Badge className="gap-1 bg-success/15 text-success hover:bg-success/20">
                    <CheckCircle2 className="size-3" aria-hidden />
                    已配置
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 border-warning/40 text-warning">
                    <AlertCircle className="size-3" aria-hidden />
                    未配置
                  </Badge>
                )}
              </div>
              <Separator />
              <dl className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="shrink-0 text-muted-foreground">接口地址</dt>
                  <dd className="truncate font-mono text-xs">{config.aiBaseUrl}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="shrink-0 text-muted-foreground">模型</dt>
                  <dd className="truncate font-mono text-xs">{config.aiModel}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="shrink-0 text-muted-foreground">超时时间</dt>
                  <dd className="font-mono text-xs">{Math.round(config.aiTimeoutMs / 1000)} 秒</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="shrink-0 text-muted-foreground">API 密钥</dt>
                  <dd className="flex items-center gap-1.5 text-xs">
                    <Lock className="size-3" aria-hidden />
                    {config.hasApiKey ? "已设置（仅服务端可见）" : "未设置"}
                  </dd>
                </div>
              </dl>
              {!config.aiConfigured && (
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <p className="text-sm font-medium">如何启用 AI 功能</p>
                  <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-muted-foreground">
                    <li>
                      复制项目根目录的 <code className="font-mono">.env.example</code> 为{" "}
                      <code className="font-mono">.env</code>
                    </li>
                    <li>
                      设置 <code className="font-mono">AI_API_KEY=你的密钥</code>
                    </li>
                    <li>
                      按需修改 <code className="font-mono">AI_BASE_URL</code>（默认 OpenAI）与{" "}
                      <code className="font-mono">AI_MODEL</code>
                    </li>
                    <li>重启应用，本页状态将变为「已配置」</li>
                  </ol>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 存储与限额 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="size-4 text-primary" aria-hidden />
                存储与限额
              </CardTitle>
              <CardDescription>
                数据保存在服务器本地目录（默认 <code className="font-mono">.data/</code>），不依赖外部数据库
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "已上传文件", value: stats?.fileCount ?? 0 },
                  { label: "任务记录", value: stats?.taskCount ?? 0 },
                  { label: "结果文件", value: stats?.resultCount ?? 0 },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border border-border/70 bg-muted/30 px-4 py-3.5 text-center">
                    <p className="text-xl font-semibold tabular-nums">{s.value}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
              <Separator />
              <dl className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="shrink-0 text-muted-foreground">单文件大小上限</dt>
                  <dd className="font-mono text-xs">{formatBytes(config.maxFileSizeBytes)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="shrink-0 text-muted-foreground">单次上传数量上限</dt>
                  <dd className="font-mono text-xs">{config.maxFilesPerUpload} 个</dd>
                </div>
              </dl>
              <p className="text-xs leading-relaxed text-muted-foreground">
                以上限额通过环境变量 <code className="font-mono">MAX_FILE_SIZE_MB</code> 与{" "}
                <code className="font-mono">MAX_FILES_PER_UPLOAD</code> 调整（需重启）。
              </p>
            </CardContent>
          </Card>

          {/* 隐私说明 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="size-4 text-primary" aria-hidden />
                隐私与数据处理
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border/70 p-4">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Server className="size-4 text-success" aria-hidden />
                    仅在你的服务器上处理
                  </p>
                  <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
                    <li>· 文件上传与存储</li>
                    <li>· 格式转换（MD / HTML / Word / PDF / CSV / JSON）</li>
                    <li>· 文本提取（PDF / Word / 网页 / 表格）</li>
                    <li>· 图片 OCR（Tesseract 本地引擎）</li>
                  </ul>
                </div>
                <div className="rounded-lg border border-border/70 p-4">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <AlertCircle className="size-4 text-warning" aria-hidden />
                    会发送到你配置的 AI 服务
                  </p>
                  <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
                    <li>· 文档总结 / 重点提取 / 文档问答</li>
                    <li>· 发送内容：文件提取出的文本（超长截断）</li>
                    <li>· 发送目标：你配置的 AI_BASE_URL</li>
                    <li>· 不配置 AI 时以上功能不可用，其余功能不受影响</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 危险区 */}
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-base text-destructive">危险区</CardTitle>
              <CardDescription>清空全部上传文件、任务记录与结果文件，此操作不可恢复。</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={resetting}
                onClick={() => setConfirmReset(true)}
              >
                {resetting ? (
                  <>
                    <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden />
                    正在清空…
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-1.5 size-4" aria-hidden />
                    清空全部数据
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <div className="flex items-center justify-end">
            <Button variant="ghost" size="sm" onClick={() => void refresh()} className="text-muted-foreground">
              <RefreshCw className="mr-1.5 size-3.5" aria-hidden />
              刷新状态
            </Button>
          </div>
        </div>
      ) : null}

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认清空全部数据？</AlertDialogTitle>
            <AlertDialogDescription>
              所有上传文件、任务记录与处理结果都将从服务器删除，且无法恢复。请确认没有需要保留的结果。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleReset()} className="bg-destructive text-white hover:bg-destructive/90">
              确认清空
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
