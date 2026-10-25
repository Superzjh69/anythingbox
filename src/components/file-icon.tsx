import { FileJson, FileSpreadsheet, FileText, FileCode2, FileType2, FileImage, ScanText } from "lucide-react";
import type { FileKind } from "@/lib/types";
import { cn } from "@/lib/utils";

const KIND_META: Record<FileKind, { Icon: typeof FileText; className: string; label: string }> = {
  text: { Icon: FileText, className: "text-sky-600 dark:text-sky-400", label: "文本" },
  markdown: { Icon: FileType2, className: "text-violet-600 dark:text-violet-400", label: "Markdown" },
  csv: { Icon: FileSpreadsheet, className: "text-emerald-600 dark:text-emerald-400", label: "表格" },
  json: { Icon: FileJson, className: "text-amber-600 dark:text-amber-400", label: "JSON" },
  html: { Icon: FileCode2, className: "text-orange-600 dark:text-orange-400", label: "HTML" },
  pdf: { Icon: ScanText, className: "text-red-600 dark:text-red-400", label: "PDF" },
  docx: { Icon: FileText, className: "text-blue-600 dark:text-blue-400", label: "Word" },
  image: { Icon: FileImage, className: "text-teal-600 dark:text-teal-400", label: "图片" },
};

export function KindIcon({ kind, className }: { kind: FileKind; className?: string }) {
  const meta = KIND_META[kind] ?? KIND_META.text;
  return <meta.Icon className={cn("size-4 shrink-0", meta.className, className)} aria-hidden />;
}

export function kindLabel(kind: FileKind): string {
  return KIND_META[kind]?.label ?? kind;
}
