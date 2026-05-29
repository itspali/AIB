const CLAUSE_DELIMITER =
  /\s*,\s*|\s+and\s+|\s+having\s+|\s+whose\s+|\s+where\s+|\s+(?=created\b)/gi;

export function segmentClauses(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  return trimmed
    .split(CLAUSE_DELIMITER)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export function collectResidualSegments(segments: string[], consumed: Set<number>): string {
  return segments
    .filter((_, index) => !consumed.has(index))
    .join(" ")
    .trim();
}
