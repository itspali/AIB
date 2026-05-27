import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "completed" | "action_required" | "locked" | "default";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
        variant === "completed" && "bg-emerald-100 text-emerald-800",
        variant === "action_required" && "bg-amber-100 text-amber-800",
        variant === "locked" && "bg-muted text-muted-foreground",
        variant === "default" && "bg-secondary text-secondary-foreground",
        className
      )}
      {...props}
    />
  );
}

export { Badge };
