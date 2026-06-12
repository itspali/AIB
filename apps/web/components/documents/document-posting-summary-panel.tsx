"use client";

import { CheckCircle2, Circle, MinusCircle, XCircle } from "lucide-react";
import { resolvePostingStepDefinition } from "@/lib/documents/posting-step-catalog";
import type { PostingStepResult } from "@/lib/documents/posting-types";
import { cn } from "@/lib/utils";

type Props = {
  steps: PostingStepResult[];
  overall?: "success" | "failure";
  postedAt?: string | null;
  className?: string;
};

function StepIcon({ status }: { status: PostingStepResult["status"] }) {
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

function statusLabel(status: PostingStepResult["status"]): string {
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

export function DocumentPostingSummaryPanel({ steps, overall, postedAt, className }: Props) {
  if (steps.length === 0) return null;

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
        {steps.map((step) => {
          const definition = resolvePostingStepDefinition(step.id);
          return (
            <li key={step.id} className="flex gap-3">
              <StepIcon status={step.status} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <p className="text-sm font-medium">{definition.label}</p>
                  <span className="text-xs text-muted-foreground">{statusLabel(step.status)}</span>
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
    </section>
  );
}
