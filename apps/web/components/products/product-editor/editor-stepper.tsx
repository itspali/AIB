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

function StageNumberBadge({
  status,
  isActive,
  index,
  dense = false,
}: {
  status: StageStatus;
  isActive: boolean;
  index: number;
  dense?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border font-semibold",
        dense ? "h-5 w-5 text-[10px]" : "h-6 w-6 text-xs",
        dotClasses(status, isActive)
      )}
    >
      {status === "complete" && !isActive ? (
        <Check className={dense ? "h-3 w-3" : "h-3.5 w-3.5"} />
      ) : (
        index + 1
      )}
    </span>
  );
}

function horizontalStageLabelClass(stageCount: number): string {
  if (stageCount <= 2) return "text-xs";
  if (stageCount === 3) return "text-[11px]";
  return "text-[10px]";
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
  const stageCount = stages.length;
  const denseHorizontal = compact && !vertical;

  return (
    <div
      className={cn(
        compact ? undefined : "space-y-3 rounded-xl border border-border bg-card p-4"
      )}
    >
      {!compact ? (
        <>
          <div className={cn("flex items-center gap-3", vertical && "justify-between")}>
            <p className="text-sm font-medium">
              Step {activeIndex + 1} of {stageCount}
            </p>
            <p className="text-xs font-medium text-muted-foreground">{percent}% complete</p>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </>
      ) : null}

      <ol
        className={cn(
          vertical ? "flex flex-col" : "flex w-full min-w-0 items-start"
        )}
      >
        {stages.map((stage, index) => {
          const status = statuses[stage.id] ?? "empty";
          const isActive = stage.id === activeStage;
          // Earlier stages (and the active one) are navigable; future stages are not.
          const navigable = index <= activeIndex && !isActive && Boolean(onSelect);

          if (vertical) {
            const isLast = index === stages.length - 1;

            return (
              <li
                key={stage.id}
                className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2"
              >
                <div className="flex flex-col items-center self-stretch">
                  <StageNumberBadge
                    status={status}
                    isActive={isActive}
                    index={index}
                  />
                  {!isLast ? (
                    <span
                      aria-hidden
                      className="mt-1 w-0.5 min-h-8 flex-1 rounded-full bg-muted-foreground/45"
                    />
                  ) : null}
                </div>
                <button
                  type="button"
                  data-wizard-stage={stage.id}
                  disabled={!navigable}
                  onClick={navigable ? () => onSelect?.(stage.id) : undefined}
                  className={cn(
                    "mb-2 flex w-full min-w-0 items-start px-2 py-1.5 text-left transition-colors",
                    navigable ? "hover:text-foreground" : "cursor-default"
                  )}
                >
                  <span
                    className={cn(
                      "min-w-0 font-medium leading-snug",
                      compact ? "text-xs" : "text-sm",
                      isActive
                        ? "font-semibold text-foreground underline decoration-primary/70 decoration-2 underline-offset-4"
                        : "text-muted-foreground"
                    )}
                  >
                    {stage.label}
                  </span>
                </button>
              </li>
            );
          }

          const isLast = index === stages.length - 1;
          const isFirst = index === 0;

          return (
            <li key={stage.id} className="flex min-w-0 flex-1 flex-col items-stretch">
              <button
                type="button"
                data-wizard-stage={stage.id}
                disabled={!navigable}
                onClick={navigable ? () => onSelect?.(stage.id) : undefined}
                className={cn(
                  "flex w-full min-w-0 flex-col items-stretch rounded-md px-0.5 transition-colors",
                  denseHorizontal ? "gap-0.5 py-0.5" : "gap-1 py-1",
                  navigable && !isActive
                    ? denseHorizontal
                      ? "hover:bg-background/40 dark:hover:bg-background/20"
                      : "hover:bg-muted/70"
                    : "cursor-default",
                  !denseHorizontal && isActive ? "bg-muted/60" : ""
                )}
              >
                <span className="flex w-full items-center">
                  <span
                    aria-hidden
                    className={cn(
                      "h-0.5 min-w-2 flex-1 rounded-full",
                      isFirst ? "invisible" : "bg-muted-foreground/45"
                    )}
                  />
                  <StageNumberBadge
                    status={status}
                    isActive={isActive}
                    index={index}
                    dense={denseHorizontal}
                  />
                  <span
                    aria-hidden
                    className={cn(
                      "h-0.5 min-w-2 flex-1 rounded-full",
                      isLast ? "invisible" : "bg-muted-foreground/45"
                    )}
                  />
                </span>
                <span
                  className={cn(
                    "w-full px-0.5 text-center font-medium leading-tight",
                    horizontalStageLabelClass(stageCount),
                    isActive
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground",
                    denseHorizontal && isActive && "underline decoration-primary/70 decoration-2 underline-offset-4",
                    denseHorizontal ? "line-clamp-1" : "line-clamp-2"
                  )}
                >
                  {stage.label}
                </span>
              </button>
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
