"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV_ITEMS = [
  { href: "/workspace", label: "工作台" },
  { href: "/tasks", label: "任务记录" },
  { href: "/settings", label: "设置" },
  { href: "/help", label: "帮助" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Boxes className="size-4" aria-hidden />
          </span>
          <span className="text-[15px]">AnythingBox</span>
        </Link>
        <nav
          className="ml-auto flex max-w-[60%] items-center gap-0.5 overflow-x-auto sm:gap-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="主导航"
        >
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "whitespace-nowrap rounded-md px-2 py-1.5 text-sm transition-colors sm:px-3",
                  active
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
                )}
              >
                {item.label}
              </Link>
            );
          })}
          <div className="ml-1 shrink-0">
            <ThemeToggle />
          </div>
        </nav>
      </div>
    </header>
  );
}
