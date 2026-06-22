"use client";

import { Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { APP_HEADER_HEIGHT_CLASS, APP_HEADER_PADDING_X_CLASS } from "@/lib/layout/app-chrome";
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
        <span className="hidden max-w-[220px] truncate text-sm text-muted-foreground sm:inline">
          {operatorEmail}
        </span>
      </div>
    </header>
  );
}
