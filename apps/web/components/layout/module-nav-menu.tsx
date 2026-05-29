"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ModuleNavItem } from "@/components/layout/module-nav";
import {
  isModuleNavChildActive,
  isModuleNavItemActive,
} from "@/lib/layout/module-nav-active";

export function MobileDrawerNavGroup({
  item,
  pathname,
  onNavigate,
}: {
  item: ModuleNavItem;
  pathname: string;
  onNavigate: () => void;
}) {
  const groupActive = isModuleNavItemActive(item, pathname);
  const Icon = item.icon;
  const children = item.children ?? [];

  return (
    <div className="flex flex-col gap-0.5">
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
          groupActive && "text-primary"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        <span>{item.label}</span>
      </div>
      {children.map((child) => {
        const childActive = isModuleNavChildActive(child, pathname, item);
        return (
          <Link
            key={child.href}
            href={child.href}
            onClick={onNavigate}
            aria-current={childActive ? "page" : undefined}
            className={cn(
              "flex items-center rounded-lg py-2.5 pl-9 pr-3 text-sm font-normal transition-colors duration-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              childActive && "nav-glow-active bg-primary/10 text-primary"
            )}
          >
            {child.label}
          </Link>
        );
      })}
    </div>
  );
}
