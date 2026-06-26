"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SETTINGS_NAV_GROUPS, SETTINGS_ROUTES } from "@/lib/settings/navigation";
import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
};

export default function SettingsLayout({ children }: Props) {
  const pathname = usePathname();
  const isHub = pathname === SETTINGS_ROUTES.hub;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {!isHub ? (
        <div className="border-b border-border bg-background/80 px-4 py-2 backdrop-blur md:px-6">
          <nav
            aria-label="Settings sections"
            className="flex gap-4 overflow-x-auto pb-1 text-sm"
          >
            <Link
              href={SETTINGS_ROUTES.hub}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              Administration
            </Link>
            {SETTINGS_NAV_GROUPS.flatMap((group) =>
              group.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "shrink-0 transition-colors",
                      active ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })
            )}
          </nav>
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}
