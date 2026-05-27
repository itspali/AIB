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
        "hidden h-full shrink-0 flex-col border-r bg-background transition-all duration-200 md:flex",
        sidebarCollapsed ? "w-16" : "w-64"
      )}
    >
      <nav aria-label="Module navigation" className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        {moduleNavItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-normal transition-colors duration-200 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active && "bg-accent text-accent-foreground",
                sidebarCollapsed && "justify-center px-2"
              )}
              title={sidebarCollapsed ? label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {!sidebarCollapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
