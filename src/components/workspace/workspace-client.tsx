"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Download,
  FileUp,
  Loader2,
  Package,
  RefreshCw,
  ScanText,
  Sparkles,
  Trash2,
  FileType2,
  FileText,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
import { KindIcon, kindLabel } from "@/components/file-icon";
import { PreviewDialog } from "@/components/workspace/preview-dialog";
import {
  deleteFile,
  fetchConfig,
  listFiles,
  resultDownloadUrl,
  runProcess,
  taskDownloadUrl,
  uploadFiles,
} from "@/lib/client/api";
import { commonTargets, FORMATS } from "@/lib/operations";
import { formatBytes, formatDuration } from "@/lib/file-utils";
import { cn } from "@/lib/utils";
import type { FileRecord, TargetFormat, TaskRecord } from "@/lib/types";

type OpType = "extract-text" | "ocr" | "convert" | "ai";

const OPS: { id: OpType; label: string; icon: typeof FileText }[] = [
  { id: "extract-text", label: "提取文本", icon: FileText },
  { id: "convert", label: "格式转换", icon: FileType2 },
  { id: "ocr", label: "OCR 识别", icon: ScanText },
  { id: "ai", label: "AI 分析", icon: Sparkles },
];

const AI_ACTIONS = [
  { id: "summarize", label: "文档总结" },
  { id: "keypoints", label: "重点提取" },
  { id: "ask", label: "文档问答" },
] as const;

export function WorkspaceClient() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [lastTask, setLastTask] = useState<TaskRecord | null>(null);

  const [op, setOp] = useState<OpType>("extract-text");
  const [target, setTarget] = useState<TargetFormat>("md");
  const [aiAction, setAiAction] = useState<(typeof AI_ACTIONS)[number]["id"]>("summarize");
  const [question, setQuestion] = useState("");

  const [aiConfigured, setAiConfigured] = useState(true);
  const [maxUploadMb, setMaxUploadMb] = useState(20);
  const [previewFile, setPreviewFile] = useState<FileRecord | null>(null);
  const [showAiOutput, setShowAiOutput] = useState(false);
  const [confirmFileId, setConfirmFileId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const [list, cfg] = await Promise.all([listFiles(), fetchConfig()]);
      setFiles(list);
      setAiConfigured(cfg.config.aiConfigured);
      setMaxUploadMb(Math.round(cfg.config.maxFileSizeBytes / 1024 / 1024));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "加载文件列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectedFiles = useMemo(() => files.filter((f) => selected.has(f.id)), [files, selected]);
  const selectedKinds = useMemo(() => [...new Set(selectedFiles.map((f) => f.kind))], [selectedFiles]);

  const availableTargets = useMemo(() => commonTargets(selectedKinds), [selectedKinds]);

  const kindsSupportOcr = selectedKinds.length > 0 && selectedKinds.every((k) => k === "image");
  const kindsSupportText = selectedKinds.length > 0 && selectedKinds.every((k) => k !== "image");
  const allImages = kindsSupportOcr;

  // 根据所选文件自动切换可用操作
  useEffect(() => {
    if (selectedFiles.length === 0) return;
    if (allImages && (op === "extract-text" || op === "convert")) setOp("ocr");
    if (!allImages && op === "ocr") setOp("extract-text");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allImages]);

  useEffect(() => {
    if (availableTargets.length > 0 && !availableTargets.includes(target)) {
      setTarget(availableTargets[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableTargets]);

  const blockReason = useMemo(() => {
    if (selectedFiles.length === 0) return "先在左侧选择至少一个文件";
    if (op === "convert") {
      if (allImages) return "图片暂不支持格式转换";
      if (availableTargets.length === 0) return "所选文件的类型没有共同的转换目标";
    }
    if (op === "ocr" && !kindsSupportOcr) return "OCR 仅支持图片文件";
    if ((op === "extract-text" || op === "ai") && !kindsSupportText) {
      return allImages ? "图片请使用 OCR 识别" : "所选文件包含暂不支持的类型";
    }
    if (op === "ai" && !aiConfigured) return "AI 服务尚未配置，请查看下方说明";
    if (op === "ai" && aiAction === "ask" && !question.trim()) return "请输入你的问题";
    return null;
  }, [selectedFiles.length, op, allImages, availableTargets.length, kindsSupportOcr, kindsSupportText, aiConfigured, aiAction, question]);

  // ── 上传 ───────────────────────────────────────────────

  const handleUpload = useCallback(
    async (fileList: FileList | File[]) => {
      const arr = Array.from(fileList);
      if (arr.length === 0) return;
      setUploading(true);
      setUploadProgress(0);
      try {
        const res = await uploadFiles(arr, setUploadProgress);
        setFiles((prev) => [...res.files, ...prev]);
        if (res.rejected.length > 0) {
          for (const r of res.rejected) {
            toast.warning(`${r.name}：${r.reason}`);
          }
        }
        toast.success(`已上传 ${res.files.length} 个文件`);
      } catch (err) {
        const e = err as Error & { rejected?: { name: string; reason: string }[] };
        if (e.rejected) {
          for (const r of e.rejected) toast.warning(`${r.name}：${r.reason}`);
        }
        toast.error(e.message);
      } finally {
        setUploading(false);
      }
    },
    [],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files.length > 0) void handleUpload(e.dataTransfer.files);
    },
    [handleUpload],
  );

  const handleDelete = useCallback(async () => {
    if (!confirmFileId) return;
    const id = confirmFileId;
    setConfirmFileId(null);
    try {
      await deleteFile(id);
      setFiles((prev) => prev.filter((f) => f.id !== id));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (previewFile?.id === id) setPreviewFile(null);
      toast.success("文件已删除");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败");
    }
  }, [confirmFileId, previewFile]);

  // ── 选择 ───────────────────────────────────────────────

  const toggleSelect = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const allSelected = files.length > 0 && selected.size === files.length;

  // ── 运行任务 ───────────────────────────────────────────

  const handleRun = useCallback(async () => {
    if (blockReason) return;
    setRunning(true);
    setLastTask(null);
    setShowAiOutput(false);
    try {
      const task = await runProcess({
        op,
        ...(op === "convert" ? { target } : {}),
        ...(op === "ai" ? { action: aiAction, ...(aiAction === "ask" ? { question: question.trim() } : {}) } : {}),
        fileIds: [...selected],
      });
      setLastTask(task);
      if (task.status === "completed") {
        toast.success(`处理完成，成功 ${task.resultIds.length} 个文件`);
      } else if (task.status === "partial") {
        toast.warning(`部分成功：${task.resultIds.length} 个成功，${task.errors?.length ?? 0} 个失败`);
      } else {
        toast.error(task.errors?.[0]?.error ?? "任务失败");
      }
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "任务执行失败");
    } finally {
      setRunning(false);
    }
  }, [blockReason, op, target, aiAction, question, selected]);

  const taskResults = lastTask?.resultIds.length ?? 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept=".txt,.log,.text,.md,.markdown,.mdx,.csv,.tsv,.json,.html,.htm,.pdf,.docx,.png,.jpg,.jpeg,.webp,.bmp,.tif,.tiff"
        onChange={(e) => {
          if (e.target.files) void handleUpload(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">文件工作台</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            上传文件，勾选后选择操作。单个文件失败不会影响同批其他文件。
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void refresh()} className="text-muted-foreground">
          <RefreshCw className="mr-1.5 size-3.5" aria-hidden />
          刷新
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr] lg:items-start">
        {/* 左：上传 + 文件列表 */}
        <div className="space-y-4">
          <div
            role="button"
            tabIndex={0}
            aria-label="上传文件"
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={cn(
              "cursor-pointer rounded-xl border border-dashed p-8 text-center transition-colors",
              dragActive
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-primary/40 hover:bg-accent/30",
            )}
          >
            <FileUp className="mx-auto mb-3 size-7 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">拖拽文件到此处，或点击选择</p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              支持 TXT / Markdown / PDF / Word / CSV / JSON / HTML / 图片，单个不超过 {maxUploadMb} MB
            </p>
          </div>

          {uploading && (
            <Card>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    正在上传…
                  </span>
                  <span className="tabular-nums text-muted-foreground">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} />
              </CardContent>
            </Card>
          )}

          {/* 文件列表 */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  正在加载…
                </div>
              ) : files.length === 0 ? (
                <div className="px-6 py-14 text-center">
                  <p className="text-sm font-medium">还没有文件</p>
                  <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
                    上传后即可提取文本、转换格式、OCR 识别或进行 AI 分析
                  </p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => inputRef.current?.click()}>
                    选择文件
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between border-b border-border/70 px-4 py-2.5">
                    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(v) => setSelected(v ? new Set(files.map((f) => f.id)) : new Set())}
                        aria-label={allSelected ? "取消全选" : "全选"}
                      />
                      全选
                    </label>
                    <span className="text-xs text-muted-foreground">
                      {files.length} 个文件{selected.size > 0 ? ` · 已选 ${selected.size} 个` : ""}
                    </span>
                  </div>
                  <ul className="divide-y divide-border/60">
                    {files.map((f) => (
                      <li
                        key={f.id}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 transition-colors",
                          selected.has(f.id) && "bg-accent/40",
                        )}
                      >
                        <Checkbox
                          checked={selected.has(f.id)}
                          onCheckedChange={(v) => toggleSelect(f.id, Boolean(v))}
                          aria-label={`选择 ${f.originalName}`}
                        />
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                          onClick={() => setPreviewFile(f)}
                          title="点击预览内容"
                        >
                          <KindIcon kind={f.kind} />
                          <span className="min-w-0">
                            <span className="block truncate text-sm">{f.originalName}</span>
                            <span className="block text-xs text-muted-foreground">
                              {formatBytes(f.size)} · {kindLabel(f.kind)} ·{" "}
                              {new Date(f.uploadedAt).toLocaleString("zh-CN", { hour12: false })}
                            </span>
                          </span>
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          aria-label={`删除 ${f.originalName}`}
                          onClick={() => setConfirmFileId(f.id)}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 右：操作面板 */}
        <div className="space-y-4 lg:sticky lg:top-20">
          <Card>
            <CardContent className="space-y-5 p-5">
              <h2 className="text-sm font-medium">处理操作</h2>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {OPS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setOp(o.id)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-xs transition-colors",
                      op === o.id
                        ? "border-primary/60 bg-primary/5 font-medium text-foreground"
                        : "border-border text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                    )}
                  >
                    <o.icon className="size-4" aria-hidden />
                    {o.label}
                  </button>
                ))}
              </div>

              {op === "convert" && (
                <div className="space-y-2">
                  <Label htmlFor="convert-target" className="text-xs text-muted-foreground">
                    目标格式
                  </Label>
                  {allImages ? (
                    <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
                      图片暂不支持格式转换，请选择文档类文件
                    </p>
                  ) : availableTargets.length === 0 ? (
                    <p className="text-xs text-muted-foreground">请先选择文件，将显示可转换的目标格式</p>
                  ) : (
                    <Select value={target} onValueChange={(v) => setTarget(v as TargetFormat)}>
                      <SelectTrigger id="convert-target" className="w-full">
                        <SelectValue placeholder="选择目标格式" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTargets.map((t) => (
                          <SelectItem key={t} value={t}>
                            {FORMATS[t].label}（.{FORMATS[t].ext}）
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {op === "ai" && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">分析类型</Label>
                    <Select value={aiAction} onValueChange={(v) => setAiAction(v as typeof aiAction)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AI_ACTIONS.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {aiAction === "ask" && (
                    <div className="space-y-2">
                      <Label htmlFor="ai-question" className="text-xs text-muted-foreground">
                        你的问题
                      </Label>
                      <Textarea
                        id="ai-question"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="例如：这份文档的主要结论是什么？"
                        rows={3}
                        className="resize-none"
                      />
                    </div>
                  )}
                  {!aiConfigured && (
                    <div className="flex gap-2.5 rounded-lg border border-warning/40 bg-warning/10 px-3.5 py-3">
                      <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                      <div className="text-xs leading-relaxed">
                        <p className="font-medium">AI 服务尚未配置</p>
                        <p className="mt-1 text-muted-foreground">
                          在项目根目录的 <code className="font-mono">.env</code> 文件中设置{" "}
                          <code className="font-mono">AI_API_KEY</code>，可选配置{" "}
                          <code className="font-mono">AI_BASE_URL</code> 与{" "}
                          <code className="font-mono">AI_MODEL</code>，然后重启应用。详情见「设置」页。
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  {selectedFiles.length > 0 ? (
                    <>
                      将处理 <span className="font-medium text-foreground">{selectedFiles.length}</span> 个文件
                    </>
                  ) : (
                    "未选择文件"
                  )}
                </div>
                <Button onClick={() => void handleRun()} disabled={Boolean(blockReason) || running}>
                  {running ? (
                    <>
                      <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden />
                      处理中…
                    </>
                  ) : (
                    "开始处理"
                  )}
                </Button>
              </div>
              {blockReason && <p className="text-xs text-muted-foreground">{blockReason}</p>}
            </CardContent>
          </Card>

          {/* AI 隐私提示 */}
          {op === "ai" && aiConfigured && (
            <p className="px-1 text-xs leading-relaxed text-muted-foreground">
              隐私提示：使用 AI 分析时，所选文件的文本内容会发送到你配置的 AI 服务地址；其余操作全部在本地完成。
            </p>
          )}
        </div>
      </div>

      {/* 结果区 */}
      <div ref={resultsRef} className="scroll-mt-20">
        {lastTask && (
          <Card className="mt-8">
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  {lastTask.status === "completed" ? (
                    <CheckCircle2 className="size-5 text-success" aria-hidden />
                  ) : lastTask.status === "partial" ? (
                    <CircleAlert className="size-5 text-warning" aria-hidden />
                  ) : (
                    <XCircle className="size-5 text-destructive" aria-hidden />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {lastTask.opLabel} · {lastTask.status === "completed" ? "全部成功" : lastTask.status === "partial" ? "部分成功" : "任务失败"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      耗时 {formatDuration(lastTask.durationMs)} · 任务已保存到「任务记录」
                    </p>
                  </div>
                </div>
                {taskResults > 1 && (
                  <Button asChild variant="outline" size="sm">
                    <a href={taskDownloadUrl(lastTask.id, true)} download>
                      <Package className="mr-1.5 size-4" aria-hidden />
                      打包下载 ZIP
                    </a>
                  </Button>
                )}
              </div>

              {/* 逐文件结果 */}
              {taskResults > 0 && (
                <ul className="divide-y divide-border/60 rounded-lg border border-border/70">
                  {lastTask.resultIds.map((rid, i) => {
                    const inputFile = lastTask.inputFiles[i];
                    return (
                      <li key={rid} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <span className="min-w-0 truncate text-sm">{inputFile?.name ?? rid}</span>
                        <Button asChild variant="ghost" size="sm" className="h-7 shrink-0 text-xs text-primary">
                          <a href={resultDownloadUrl(rid)} download>
                            <Download className="mr-1 size-3.5" aria-hidden />
                            下载
                          </a>
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* 失败明细 */}
              {lastTask.errors && lastTask.errors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-destructive">失败明细</p>
                  <ul className="space-y-1.5">
                    {lastTask.errors.map((e, i) => (
                      <li key={i} className="rounded-lg border border-destructive/25 bg-destructive/5 px-3.5 py-2.5 text-xs leading-relaxed">
                        <span className="font-medium">{e.name}</span>
                        <span className="mx-1.5 text-border">·</span>
                        <span className="text-muted-foreground">{e.error}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* AI 输出预览 */}
              {lastTask.aiOutputs && lastTask.aiOutputs.length > 0 && (
                <div className="space-y-2">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg px-1 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                    onClick={() => setShowAiOutput((v) => !v)}
                  >
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="size-3.5 text-primary" aria-hidden />
                      AI 输出预览（{lastTask.aiOutputs.length} 个）
                    </span>
                    <ChevronDown className={cn("size-3.5 transition-transform", showAiOutput && "rotate-180")} aria-hidden />
                  </button>
                  {showAiOutput &&
                    lastTask.aiOutputs.map((o, i) => (
                      <div key={i} className="rounded-lg border border-border/70 bg-muted/30 p-4">
                        <p className="mb-2 text-xs font-medium">{o.name}</p>
                        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">
                          {o.output}
                        </pre>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* 预览 */}
      <PreviewDialog
        fileId={previewFile?.id ?? null}
        fileName={previewFile?.originalName ?? ""}
        onClose={() => setPreviewFile(null)}
      />

      {/* 删除确认 */}
      <AlertDialog open={Boolean(confirmFileId)} onOpenChange={(open) => !open && setConfirmFileId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除文件？</AlertDialogTitle>
            <AlertDialogDescription>
              将从服务器删除「{files.find((f) => f.id === confirmFileId)?.originalName}」及其原始数据，已生成的历史任务结果不受影响。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()} className="bg-destructive text-white hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
