import Link from "next/link";
import { Boxes } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:px-6">
        <div className="flex items-center gap-2">
          <Boxes className="size-4" aria-hidden />
          <span>AnythingBox — 本地优先的 AI 文件处理工作台</span>
        </div>
        <nav className="flex gap-4" aria-label="页脚导航">
          <Link href="/help" className="transition-colors hover:text-foreground">
            使用帮助
          </Link>
          <Link href="/settings" className="transition-colors hover:text-foreground">
            隐私与数据
          </Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer noopener"
            className="transition-colors hover:text-foreground"
          >
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
