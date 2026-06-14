"use client";

import { Check, Circle, Lock } from "lucide-react";
import type { ApprovalRunStep, DocumentApprovalRun } from "@/lib/approvals/types";
import { cn } from "@/lib/utils";

type Props = {
  run: DocumentApprovalRun | null;
  currentUserId?: string;
  compact?: boolean;
  className?: string;
};

function stepStatusIcon(step: ApprovalRunStep) {
  if (step.status === "SATISFIED") {
    return <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />;
  }
  if (step.status === "PENDING") {
    return (
      <Circle className="size-3.5 shrink-0 fill-amber-500 text-amber-500" aria-hidden />
    );
  }
  if (step.status === "REJECTED") {
    return <Circle className="size-3.5 shrink-0 fill-destructive text-destructive" aria-hidden />;
  }
  return <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />;
}

function quorumLabel(step: ApprovalRunStep): string {
  return step.quorum_mode === "ALL" ? "ALL" : "ANY";
}

function stepSummary(step: ApprovalRunStep, currentUserId?: string): string {
  const pendingAssignees = step.assignees.filter((a) => !a.decision);
  const names = pendingAssignees.length;
  const you =
    currentUserId && pendingAssignees.some((a) => a.user_id === currentUserId) ? " · includes you" : "";
  if (step.status === "SATISFIED") return "Complete";
  if (step.status === "PENDING") return `${names} assignee(s) · ${quorumLabel(step)}${you}`;
  if (step.status === "LOCKED") return "Waiting for prior level";
  return step.status;
}

export function ApprovalWorkflowStepper({ run, currentUserId, compact = false, className }: Props) {
  if (!run?.steps.length) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        No multi-level approval workflow for this document.
      </p>
    );
  }

  const levelIndexes = [...new Set(run.steps.map((step) => step.level_index))].sort((a, b) => a - b);

  if (compact) {
    const active = run.steps.find((step) => step.status === "PENDING");
    const levelTotal = levelIndexes.length;
    const levelCurrent = active ? active.level_index + 1 : levelTotal;
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        Level {levelCurrent}/{levelTotal}
        {active ? ` · ${active.step_label} (${quorumLabel(active)})` : ""}
      </p>
    );
  }

  return (
    <ol className={cn("space-y-0", className)} aria-label="Approval workflow">
      {run.steps.map((step, index) => (
        <li key={step.id} className="relative flex gap-3 pb-5 last:pb-0">
          <div className="flex flex-col items-center">
            {stepStatusIcon(step)}
            {index < run.steps.length - 1 ? (
              <span className="mt-1 w-px flex-1 bg-border" aria-hidden />
            ) : null}
          </div>
          <div className="min-w-0 flex-1 -mt-0.5">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p
                className={cn(
                  "text-sm font-medium",
                  step.status === "PENDING" && "text-amber-700 dark:text-amber-300"
                )}
              >
                L{step.level_index + 1} · {step.step_label}
              </p>
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {quorumLabel(step)}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{stepSummary(step, currentUserId)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
