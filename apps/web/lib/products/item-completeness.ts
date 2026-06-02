/**
 * Pure rollups for the create wizard's completeness indicator. These operate on
 * the editor's existing per-section status so the indicator can never drift
 * from the section logic that produces it.
 */
export type SectionStatus = "error" | "complete" | "empty";

/** A stage aggregates several sections. */
export type StageStatus = "error" | "complete" | "partial" | "empty";

/**
 * Roll several section statuses into a single stage status:
 * - any error  -> "error"
 * - all complete (and at least one section) -> "complete"
 * - some complete -> "partial"
 * - otherwise -> "empty"
 */
export function rollUpStageStatus(statuses: SectionStatus[]): StageStatus {
  if (statuses.length === 0) return "empty";
  if (statuses.some((status) => status === "error")) return "error";
  const completed = statuses.filter((status) => status === "complete").length;
  if (completed === statuses.length) return "complete";
  if (completed > 0) return "partial";
  return "empty";
}

/**
 * Overall completeness as a 0-100 integer, counting "complete" sections against
 * the total applicable sections. Errors do not count as complete.
 */
export function overallCompletenessPercent(statuses: SectionStatus[]): number {
  if (statuses.length === 0) return 0;
  const completed = statuses.filter((status) => status === "complete").length;
  return Math.round((completed / statuses.length) * 100);
}
