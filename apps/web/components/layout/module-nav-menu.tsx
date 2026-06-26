"use client";

import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { NavTextLinkContent } from "@/components/layout/nav-link-content";
import type { ModuleNavItem } from "@/components/layout/module-nav";
import {
  isModuleNavChildActive,
  isModuleNavGroupExpanded,
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
  const defaultExpanded = isModuleNavGroupExpanded(item, pathname);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const Icon = item.icon;
  const children = item.children ?? [];

  useEffect(() => {
    setExpanded(defaultExpanded);
  }, [pathname, defaultExpanded]);

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={expanded ? `Collapse ${item.label} menu` : `Expand ${item.label} menu`}
        onClick={() => setExpanded((value) => !value)}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-normal transition-colors duration-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          groupActive && "nav-glow-active bg-primary/10 text-primary"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
      </button>
      {expanded
        ? children.map((child) => {
            const childActive = isModuleNavChildActive(child, pathname, item);
            return (
              <Link
                key={child.href}
                href={child.href}
                prefetch
                onClick={onNavigate}
                aria-current={childActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-lg py-2.5 pl-9 pr-3 text-sm font-normal transition-colors duration-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  childActive && "nav-glow-active bg-primary/10 text-primary"
                )}
              >
                <NavTextLinkContent
                  icon={child.icon}
                  iconClassName={childActive ? "text-primary" : undefined}
                >
                  {child.label}
                </NavTextLinkContent>
              </Link>
            );
          })
        : null}
    </div>
  );
}
