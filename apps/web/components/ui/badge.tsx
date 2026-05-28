import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "completed" | "active" | "action_required" | "locked" | "default";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors duration-200",
        variant === "completed" &&
          "bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/30 dark:text-emerald-300 dark:ring-emerald-500/25",
        variant === "active" &&
          "bg-indigo-500/15 text-indigo-700 ring-1 ring-indigo-500/30 dark:text-indigo-300 dark:ring-indigo-500/25",
        variant === "action_required" &&
          "bg-amber-500/15 text-amber-800 ring-1 ring-amber-500/30 dark:text-amber-300 dark:ring-amber-500/25",
        variant === "locked" && "bg-muted/80 text-muted-foreground ring-1 ring-border",
        variant === "default" && "bg-secondary text-secondary-foreground",
        className
      )}
      {...props}
    />
  );
}

export { Badge };
