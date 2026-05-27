"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { moduleNavItems } from "@/components/layout/module-nav";

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Module navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="grid h-14 grid-cols-6">
        {moduleNavItems.map(({ href, label, shortLabel, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-0.5 text-[10px] font-medium leading-none transition-colors duration-200",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{shortLabel}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
