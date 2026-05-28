"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useOnboardingContext } from "@/components/onboarding/onboarding-context";
import { moduleNavItems } from "@/components/layout/module-nav";

export function SidebarNav() {
  const pathname = usePathname();
  const { sidebarCollapsed } = useOnboardingContext();

  return (
    <aside
      className={cn(
        "hidden h-full shrink-0 flex-col border-r border-white/10 bg-card/40 backdrop-blur-xl transition-all duration-200 md:flex",
        sidebarCollapsed ? "w-16" : "w-64"
      )}
    >
      {!sidebarCollapsed && (
        <div className="border-b border-white/10 px-4 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Modules
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground/70">ERP command rail</p>
        </div>
      )}
      <nav aria-label="Module navigation" className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        {moduleNavItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-normal transition-colors duration-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active && "nav-glow-active bg-primary/10 text-primary",
                sidebarCollapsed && "justify-center px-2"
              )}
              title={sidebarCollapsed ? label : undefined}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors duration-200",
                  active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}
                aria-hidden
              />
              {!sidebarCollapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
