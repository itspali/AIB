"use client";

import { cn } from "@/lib/utils";

const STEPS = ["Creating account", "Setting up workspace", "Redirecting"] as const;

type Props = {
  activeIndex: number;
  className?: string;
};

export function SignupProgressSteps({ activeIndex, className }: Props) {
  return (
    <div className={cn("space-y-4", className)} aria-busy="true" aria-label="Creating workspace">
      <ol className="space-y-3">
        {STEPS.map((label, index) => {
          const isComplete = index < activeIndex;
          const isActive = index === activeIndex;
          return (
            <li key={label} className="flex items-center gap-3 text-sm">
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                  isComplete && "border-emerald-500 bg-emerald-500 text-white",
                  isActive && !isComplete && "border-primary bg-primary/10 text-primary",
                  !isComplete && !isActive && "border-muted-foreground/30 text-muted-foreground"
                )}
              >
                {isComplete ? "✓" : index + 1}
              </span>
              <span
                className={cn(
                  isActive && "font-medium text-foreground",
                  !isActive && "text-muted-foreground"
                )}
              >
                {label}
                {isActive ? "…" : ""}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
