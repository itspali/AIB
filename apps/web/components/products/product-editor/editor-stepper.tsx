"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StageStatus } from "@/lib/products/item-completeness";

export type WizardStep<T extends string = string> = {
  id: T;
  label: string;
  description: string;
};

type Props<T extends string> = {
  stages: WizardStep<T>[];
  activeStage: T;
  statuses: Record<T, StageStatus>;
  /** Overall completeness, 0-100. */
  percent: number;
  /** Invoked when a navigable (already-reachable) stage is clicked. */
  onSelect?: (stage: T) => void;
  compact?: boolean;
  vertical?: boolean;
  showDescription?: boolean;
};

function dotClasses(status: StageStatus, active: boolean): string {
  if (active) return "border-primary bg-primary text-primary-foreground";
  switch (status) {
    case "error":
      return "border-destructive bg-destructive/10 text-destructive";
    case "complete":
      return "border-emerald-500 bg-emerald-500 text-white";
    case "partial":
      return "border-primary/50 bg-primary/10 text-primary";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

export function EditorStepper<T extends string>({
  stages,
  activeStage,
  statuses,
  percent,
  onSelect,
  compact = false,
  vertical = false,
  showDescription = true,
}: Props<T>) {
  const activeIndex = stages.findIndex((stage) => stage.id === activeStage);
  const active = stages[activeIndex];

  return (
    <div
      className={cn(
        compact ? "space-y-2" : "space-y-3 rounded-xl border border-border bg-card p-4"
      )}
    >
      <div className={cn("flex items-center gap-3", vertical && "justify-between")}>
        <p className={cn("font-medium", compact ? "text-xs" : "text-sm")}>
          Step {activeIndex + 1} of {stages.length}
        </p>
        <p className="text-xs font-medium text-muted-foreground">{percent}% complete</p>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>

      <ol className={cn(vertical ? "flex flex-col gap-2" : "flex flex-wrap items-center gap-x-2 gap-y-2")}>
        {stages.map((stage, index) => {
          const status = statuses[stage.id] ?? "empty";
          const isActive = stage.id === activeStage;
          // Earlier stages (and the active one) are navigable; future stages are not.
          const navigable = index <= activeIndex && !isActive && Boolean(onSelect);

          return (
            <li key={stage.id} className={cn("flex", vertical ? "items-stretch gap-2" : "items-center gap-2")}>
              <button
                type="button"
                disabled={!navigable}
                onClick={navigable ? () => onSelect?.(stage.id) : undefined}
                className={cn(
                  vertical
                    ? "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors"
                    : "flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-left transition-colors",
                  navigable ? "hover:bg-muted" : "cursor-default",
                  isActive ? "bg-muted/60" : ""
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                    dotClasses(status, isActive)
                  )}
                >
                  {status === "complete" && !isActive ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span
                  className={cn(
                    "text-sm font-medium",
                    isActive ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {stage.label}
                </span>
              </button>
              {index < stages.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(vertical ? "mx-3 h-4 w-px bg-border" : "h-px w-4 bg-border sm:w-6")}
                />
              ) : null}
            </li>
          );
        })}
      </ol>

      {showDescription && active ? (
        <p className="text-xs text-muted-foreground">{active.description}</p>
      ) : null}
    </div>
  );
}
