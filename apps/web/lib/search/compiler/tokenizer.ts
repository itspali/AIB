const CLAUSE_DELIMITER =
  /\s*,\s*|\s+and\s+|\s+having\s+|\s+whose\s+|\s+where\s+|\s+(?=created\b)/gi;

const BETWEEN_AND_PLACEHOLDER = "__between_and__";

/** Prevent "between 500 and 1000" from splitting on the inner "and". */
function protectBetweenAnd(query: string): string {
  return query.replace(
    /\bbetween\s+([\d,]+(?:\.\d+)?)\s+and\s+([\d,]+(?:\.\d+)?)/gi,
    `between $1 ${BETWEEN_AND_PLACEHOLDER} $2`
  );
}

function restoreBetweenAnd(segment: string): string {
  return segment.replace(new RegExp(BETWEEN_AND_PLACEHOLDER, "g"), "and");
}

export function segmentClauses(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  return protectBetweenAnd(trimmed)
    .split(CLAUSE_DELIMITER)
    .map((segment) => restoreBetweenAnd(segment.trim()))
    .filter(Boolean);
}

export function collectResidualSegments(segments: string[], consumed: Set<number>): string {
  return segments
    .filter((_, index) => !consumed.has(index))
    .join(" ")
    .trim();
}
