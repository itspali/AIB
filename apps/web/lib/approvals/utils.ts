import type { DocumentApprovalRun } from "@/lib/approvals/types";

export function resolveActiveApprovalStep(
  run: DocumentApprovalRun | null,
  userId: string
): DocumentApprovalRun["steps"][0] | null {
  if (!run || run.status !== "PENDING") return null;

  return (
    run.steps.find(
      (step) =>
        step.status === "PENDING" &&
        step.assignees.some((assignee) => assignee.user_id === userId)
    ) ?? null
  );
}

export function countApprovalLevels(run: DocumentApprovalRun | null): number {
  if (!run?.steps.length) return 0;
  return new Set(run.steps.map((step) => step.level_index)).size;
}
