"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { APP_HEADER_HEIGHT_CLASS, APP_HEADER_PADDING_X_CLASS } from "@/lib/layout/app-chrome";
import { createClient } from "@/lib/supabase/client";
import type { AppConsoleRole } from "@/lib/console/types";
import { cn } from "@/lib/utils";

type ConsoleTopStripProps = {
  operatorEmail: string;
  operatorRole: AppConsoleRole;
  className?: string;
};

function consoleRoleBadgeVariant(role: AppConsoleRole) {
  switch (role) {
    case "ADMIN":
      return "administrative" as const;
    case "OPERATOR":
      return "active" as const;
    case "VIEWER":
    default:
      return "locked" as const;
  }
}

export function ConsoleTopStrip({ operatorEmail, operatorRole, className }: ConsoleTopStripProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSignOut = () => {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    });
  };

  return (
    <header
      className={cn(
        APP_HEADER_HEIGHT_CLASS,
        APP_HEADER_PADDING_X_CLASS,
        "flex shrink-0 items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/20 via-violet-600/10 to-slate-500/10 ring-1 ring-violet-500/25"
          aria-hidden
        >
          <Shield className="h-4 w-4 text-violet-600 dark:text-violet-300" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight">App Console</p>
          <p className="truncate text-xs text-muted-foreground">Control Plane</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Badge variant={consoleRoleBadgeVariant(operatorRole)}>{operatorRole}</Badge>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 max-w-[240px] gap-1.5 px-2 text-muted-foreground"
              disabled={isPending}
            >
              <span className="hidden truncate sm:inline">{operatorEmail}</span>
              <span className="truncate sm:hidden">Account</span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
              {operatorEmail}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              disabled={isPending}
              onSelect={() => handleSignOut()}
            >
              <LogOut className="h-4 w-4" aria-hidden />
              {isPending ? "Signing out…" : "Sign out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
