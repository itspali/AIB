"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavModuleLinkContent } from "@/components/layout/nav-link-content";
import { moduleNavItems } from "@/components/layout/module-nav";
import { isModuleNavItemActive, getModuleNavEntryHref } from "@/lib/layout/module-nav-active";

type Props = {
  onOpenMore?: () => void;
};

export function MobileBottomNav({ onOpenMore }: Props) {
  const pathname = usePathname();
  const primaryItems = moduleNavItems.filter((item) => item.mobilePrimary);
  const cellCount = primaryItems.length + 1;

  return (
    <nav
      aria-label="Module navigation"
      className="glass-v2-app-mobile-nav fixed inset-x-0 bottom-0 z-50 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <div className="grid h-14" style={{ gridTemplateColumns: `repeat(${cellCount}, minmax(0, 1fr))` }}>
        {primaryItems.map((item) => {
          const { label, shortLabel, icon: Icon } = item;
          const href = getModuleNavEntryHref(item);
          const active = isModuleNavItemActive(item, pathname);
          return (
            <Link
              key={item.href}
              href={href}
              prefetch
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 px-0.5 text-[10px] font-medium leading-none transition-colors duration-200",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {active && (
                <span
                  className="absolute inset-x-2 top-0 h-0.5 rounded-full bg-primary shadow-glow-sm"
                  aria-hidden
                />
              )}
              <NavModuleLinkContent
                icon={Icon}
                label={<span className="truncate">{shortLabel}</span>}
                labelClassName="truncate"
                iconClassName="shrink-0"
              />
            </Link>
          );
        })}

        <button
          type="button"
          onClick={onOpenMore}
          aria-label="More navigation"
          className="relative flex flex-col items-center justify-center gap-0.5 px-0.5 text-[10px] font-medium leading-none text-muted-foreground transition-colors duration-200 hover:text-foreground"
        >
          <MoreHorizontal className="size-4 shrink-0" aria-hidden />
          <span className="truncate">More</span>
        </button>
      </div>
    </nav>
  );
}
