"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock,
  Download,
  Loader2,
  Package,
  RefreshCw,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { deleteTask, listTasks, resultDownloadUrl, taskDownloadUrl } from "@/lib/client/api";
import { formatDuration } from "@/lib/file-utils";
import { cn } from "@/lib/utils";
import type { TaskRecord } from "@/lib/types";

function StatusBadge({ status }: { status: TaskRecord["status"] }) {
  if (status === "completed") {
    return (
      <Badge className="gap-1 bg-success/15 text-success hover:bg-success/20">
        <CheckCircle2 className="size-3" aria-hidden />
        全部成功
      </Badge>
    );
  }
  if (status === "partial") {
    return (
      <Badge className="gap-1 bg-warning/15 text-warning hover:bg-warning/20">
        <CircleAlert className="size-3" aria-hidden />
        部分成功
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="gap-1">
      <XCircle className="size-3" aria-hidden />
      失败
    </Badge>
  );
}

export function TasksClient() {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setTasks(await listTasks());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "加载任务列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = async () => {
    if (!confirmId) return;
    const id = confirmId;
    setConfirmId(null);
    try {
      await deleteTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
      toast.success("任务已删除");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败");
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">任务记录</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            每次处理的完整历史：状态、耗时、输入文件、失败原因与结果下载。
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void refresh()} className="text-muted-foreground">
          <RefreshCw className="mr-1.5 size-3.5" aria-hidden />
          刷新
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          正在加载…
        </div>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="px-6 py-20 text-center">
            <Clock className="mx-auto mb-3 size-8 text-muted-foreground/60" aria-hidden />
            <p className="text-sm font-medium">还没有任务记录</p>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
              到工作台上传文件并执行一次处理，任务记录会出现在这里
            </p>
            <Button asChild size="sm" className="mt-5">
              <Link href="/workspace">打开工作台</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {tasks.map((t) => {
            const isOpen = expanded.has(t.id);
            const hasDetails = Boolean(t.errors?.length || t.aiOutputs?.length);
            return (
              <li key={t.id}>
                <Card>
                  <CardContent className="p-0">
                    <div className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
                      <StatusBadge status={t.status} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {t.opLabel}
                          <span className="ml-2 font-normal text-muted-foreground">
                            {t.inputFiles.length} 个文件
                          </span>
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {new Date(t.createdAt).toLocaleString("zh-CN", { hour12: false })} · 耗时{" "}
                          {formatDuration(t.durationMs)}
                          {t.resultIds.length > 0 ? ` · ${t.resultIds.length} 个结果` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {t.resultIds.length > 1 && (
                          <Button asChild variant="outline" size="sm" className="h-8">
                            <a href={taskDownloadUrl(t.id, true)} download>
                              <Package className="mr-1.5 size-3.5" aria-hidden />
                              ZIP
                            </a>
                          </Button>
                        )}
                        {t.resultIds.length === 1 && (
                          <Button asChild variant="outline" size="sm" className="h-8">
                            <a href={resultDownloadUrl(t.resultIds[0])} download>
                              <Download className="mr-1.5 size-3.5" aria-hidden />
                              下载
                            </a>
                          </Button>
                        )}
                        {hasDetails && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground"
                            aria-label={isOpen ? "收起详情" : "展开详情"}
                            onClick={() => toggleExpand(t.id)}
                          >
                            <ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} aria-hidden />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          aria-label="删除任务"
                          onClick={() => setConfirmId(t.id)}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="space-y-4 border-t border-border/60 px-4 py-4 sm:px-5">
                        {t.detail && <p className="text-xs text-muted-foreground">{t.detail}</p>}

                        {t.errors && t.errors.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium text-destructive">失败原因</p>
                            {t.errors.map((e, i) => (
                              <p
                                key={i}
                                className="rounded-lg border border-destructive/25 bg-destructive/5 px-3.5 py-2.5 text-xs leading-relaxed"
                              >
                                <span className="font-medium">{e.name}</span>
                                <span className="mx-1.5 text-border">·</span>
                                <span className="text-muted-foreground">{e.error}</span>
                              </p>
                            ))}
                          </div>
                        )}

                        {t.aiOutputs && t.aiOutputs.length > 0 && (
                          <div className="space-y-2">
                            <p className="flex items-center gap-1.5 text-xs font-medium">
                              <Sparkles className="size-3.5 text-primary" aria-hidden />
                              AI 输出
                            </p>
                            {t.aiOutputs.map((o, i) => (
                              <div key={i} className="rounded-lg border border-border/70 bg-muted/30 p-4">
                                <p className="mb-2 text-xs font-medium">{o.name}</p>
                                <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">
                                  {o.output}
                                </pre>
                              </div>
                            ))}
                          </div>
                        )}

                        <div>
                          <p className="mb-1.5 text-xs font-medium text-muted-foreground">输入文件</p>
                          <ul className="space-y-1">
                            {t.inputFiles.map((f) => (
                              <li key={f.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="size-1 rounded-full bg-border" aria-hidden />
                                {f.name}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog open={Boolean(confirmId)} onOpenChange={(open) => !open && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除任务？</AlertDialogTitle>
            <AlertDialogDescription>
              将删除该任务记录及其全部结果文件，此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDelete()}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
