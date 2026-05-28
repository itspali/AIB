import type { UserRole } from "@/lib/user/types";
import { cn } from "@/lib/utils";

export function roleBadgeLabel(role: UserRole): string {
  return role;
}

export function roleBadgeClassName(role: UserRole): string {
  return cn(
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors duration-200",
    role === "OWNER" &&
      "bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/30 dark:text-emerald-300 dark:ring-emerald-500/25",
    role === "ADMIN" &&
      "bg-indigo-500/15 text-indigo-700 ring-1 ring-indigo-500/30 dark:text-indigo-300 dark:ring-indigo-500/25",
    role === "MANAGER" &&
      "bg-violet-500/15 text-violet-700 ring-1 ring-violet-500/30 dark:text-violet-300 dark:ring-violet-500/25",
    role === "STAFF" && "bg-muted/80 text-muted-foreground ring-1 ring-border"
  );
}
