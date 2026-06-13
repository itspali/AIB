import type { PostingStepResult } from "@/lib/documents/posting-types";

export function isNotApplicablePostingStep(step: PostingStepResult): boolean {
  return step.status === "skipped" || step.status === "not_run";
}

export function countNotApplicablePostingSteps(steps: readonly PostingStepResult[]): number {
  return steps.filter(isNotApplicablePostingStep).length;
}

export function filterApplicablePostingSteps(
  steps: readonly PostingStepResult[]
): PostingStepResult[] {
  return steps.filter((step) => !isNotApplicablePostingStep(step));
}

export function resolveVisiblePostingSteps(
  steps: readonly PostingStepResult[],
  showNotApplicable: boolean
): PostingStepResult[] {
  if (showNotApplicable) return [...steps];
  return filterApplicablePostingSteps(steps);
}
