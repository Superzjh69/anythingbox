"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { KindIcon } from "@/components/file-icon";
import type { FileKind } from "@/lib/types";

export interface PreviewData {
  kind: FileKind;
  textPreview?: string;
  imageBase64?: string;
  table?: { fields: string[]; rows: Record<string, string>[]; totalRows: number } | null;
  pages?: number;
  truncated?: boolean;
}

export function PreviewDialog({
  fileId,
  fileName,
  onClose,
}: {
  fileId: string | null;
  fileName: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!fileId) {
      setData(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/files/${fileId}/preview`)
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `预览失败（HTTP ${res.status}）`);
        }
        return res.json();
      })
      .then((json: PreviewData) => {
        if (!cancelled) setData(json);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  return (
    <Dialog open={Boolean(fileId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 truncate pr-6">
            {data && <KindIcon kind={data.kind} />}
            <span className="truncate">{fileName}</span>
          </DialogTitle>
          <DialogDescription>内容预览（仅展示前一部分）</DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            正在读取文件…
          </div>
        )}
        {!loading && error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {!loading && !error && data && (
          <div className="space-y-3">
            {data.pages ? (
              <p className="text-xs text-muted-foreground">共 {data.pages} 页</p>
            ) : null}

            {data.table ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  共 {data.table.totalRows} 行，预览前 {data.table.rows.length} 行
                </p>
                <ScrollArea className="max-h-[50vh] rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        {data.table.fields.map((f) => (
                          <th key={f} className="whitespace-nowrap px-3 py-2 text-left font-medium">
                            {f}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.table.rows.map((row, i) => (
                        <tr key={i} className="border-t border-border/70">
                          {data.table!.fields.map((f) => (
                            <td
                              key={f}
                              className="max-w-56 truncate whitespace-nowrap px-3 py-2 text-muted-foreground"
                              title={row[f] ?? ""}
                            >
                              {row[f] ?? ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>
            ) : data.imageBase64 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.imageBase64}
                alt={fileName}
                className="mx-auto max-h-[50vh] rounded-lg border border-border object-contain"
              />
            ) : data.textPreview !== undefined ? (
              <ScrollArea className="max-h-[50vh] rounded-lg border border-border bg-muted/30 p-4">
                <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">
                  {data.textPreview || "（文件内容为空）"}
                </pre>
              </ScrollArea>
            ) : null}

            {data.truncated && !data.table ? (
              <p className="text-xs text-muted-foreground">内容较长，仅展示前 4000 字符。完整内容请使用“提取文本”。</p>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function PreviewTriggerButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={onClick}>
      预览
    </Button>
  );
}
