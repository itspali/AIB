"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  Building2,
  Clock,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Receipt,
  ScrollText,
  Settings,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type ConsoleNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** When true, only an exact pathname match counts as active. */
  exact?: boolean;
};

export const CONSOLE_NAV_ITEMS: ConsoleNavItem[] = [
  { href: "/console", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/console/tenants", label: "Tenants", icon: Building2 },
  { href: "/console/signups", label: "Signups", icon: UserPlus },
  { href: "/console/trials", label: "Trials", icon: Clock },
  { href: "/console/plans", label: "Plans", icon: CreditCard },
  { href: "/console/subscriptions", label: "Subscriptions", icon: Receipt },
  { href: "/console/groups", label: "Groups", icon: Users },
  { href: "/console/audit", label: "Audit", icon: ScrollText },
  { href: "/console/settings", label: "Settings", icon: Settings },
];

function isConsoleNavActive(item: ConsoleNavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

type ConsoleNavProps = {
  className?: string;
  onNavigate?: () => void;
};

export function ConsoleNav({ className, onNavigate }: ConsoleNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSignOut = () => {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      onNavigate?.();
      router.push("/login");
      router.refresh();
    });
  };

  return (
    <nav aria-label="App Console" className={cn("flex h-full flex-col", className)}>
      <div className="flex flex-1 flex-col gap-1 p-3">
      {CONSOLE_NAV_ITEMS.map((item) => {
        const active = isConsoleNavActive(item, pathname);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            onClick={onNavigate}
            className={cn(
              "group flex h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm font-normal transition-colors duration-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active && "nav-glow-active bg-primary/10 text-primary"
            )}
          >
            <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
      </div>

      <div className="mt-auto border-t border-border p-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={handleSignOut}
          className="h-10 w-full justify-start gap-2.5 px-2.5 text-destructive/90 hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden />
          {isPending ? "Signing out…" : "Sign out"}
        </Button>
      </div>
    </nav>
  );
}
