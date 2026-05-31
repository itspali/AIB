"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NavModuleLinkContent } from "@/components/layout/nav-link-content";
import { moduleNavItems } from "@/components/layout/module-nav";
import { isModuleNavItemActive } from "@/lib/layout/module-nav-active";

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Module navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <div className="grid h-14 grid-cols-6">
        {moduleNavItems.map((item) => {
          const { href, label, shortLabel, icon: Icon } = item;
          const active = isModuleNavItemActive(item, pathname);
          return (
            <Link
              key={href}
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
      </div>
    </nav>
  );
}
