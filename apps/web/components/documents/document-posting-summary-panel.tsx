"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Circle, MinusCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolvePostingStepDefinition } from "@/lib/documents/posting-step-catalog";
import {
  countNotApplicablePostingSteps,
  resolveVisiblePostingSteps,
} from "@/lib/documents/posting-step-visibility";
import type { PostingStepResult } from "@/lib/documents/posting-types";
import { cn } from "@/lib/utils";

type Props = {
  steps: PostingStepResult[];
  overall?: "success" | "failure";
  postedAt?: string | null;
  className?: string;
};

export function PostingStepStatusIcon({ status }: { status: PostingStepResult["status"] }) {
  switch (status) {
    case "success":
      return <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden />;
    case "failure":
      return <XCircle className="size-4 shrink-0 text-destructive" aria-hidden />;
    case "skipped":
      return <MinusCircle className="size-4 shrink-0 text-muted-foreground" aria-hidden />;
    default:
      return <Circle className="size-4 shrink-0 text-muted-foreground/50" aria-hidden />;
  }
}

export function postingStepStatusLabel(status: PostingStepResult["status"]): string {
  switch (status) {
    case "success":
      return "Completed";
    case "failure":
      return "Failed";
    case "skipped":
      return "Not needed";
    default:
      return "Not run";
  }
}

function notApplicableToggleLabel(count: number, expanded: boolean): string {
  const noun = count === 1 ? "step" : "steps";
  return expanded
    ? "Hide not applicable steps"
    : `Show ${count} not applicable ${noun}`;
}

export function DocumentPostingSummaryPanel({ steps, overall, postedAt, className }: Props) {
  const [showNotApplicable, setShowNotApplicable] = useState(false);

  if (steps.length === 0) return null;

  const notApplicableCount = countNotApplicablePostingSteps(steps);
  const visibleSteps = resolveVisiblePostingSteps(steps, showNotApplicable);

  const subtitle =
    overall === "failure"
      ? "Nothing was saved. Fix the issue below and try again."
      : "All updates completed for this document.";

  return (
    <section
      className={cn("rounded-lg border border-border bg-muted/30 p-4", className)}
      aria-label="Posting activity summary"
    >
      <div className="mb-3 space-y-1">
        <h3 className="text-sm font-semibold">What was updated</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
        {postedAt ? (
          <p className="text-xs text-muted-foreground">Posted on {postedAt}</p>
        ) : null}
      </div>

      <ol className="space-y-3">
        {visibleSteps.map((step) => {
          const definition = resolvePostingStepDefinition(step.id);
          return (
            <li key={step.id} className="flex gap-3">
              <PostingStepStatusIcon status={step.status} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <p className="text-sm font-medium">{definition.label}</p>
                  <span className="text-xs text-muted-foreground">
                    {postingStepStatusLabel(step.status)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{definition.description}</p>
                {step.detail ? (
                  <p className="mt-0.5 text-xs font-medium text-foreground/80">{step.detail}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {notApplicableCount > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-3 h-auto px-0 py-1 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground"
          aria-expanded={showNotApplicable}
          onClick={() => setShowNotApplicable((current) => !current)}
        >
          {showNotApplicable ? (
            <ChevronUp className="size-3.5 shrink-0" aria-hidden />
          ) : (
            <ChevronDown className="size-3.5 shrink-0" aria-hidden />
          )}
          {notApplicableToggleLabel(notApplicableCount, showNotApplicable)}
        </Button>
      ) : null}
    </section>
  );
}
