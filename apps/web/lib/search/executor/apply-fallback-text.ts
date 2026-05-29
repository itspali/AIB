import type { AstClause } from "@/lib/search/types";

export function applyFallbackTextFilter<T extends { name?: string | null; description?: string | null }>(
  rows: T[],
  residualText: string
): T[] {
  const q = residualText.trim().toLowerCase();
  if (!q) return rows;

  return rows.filter((row) => {
    const name = row.name?.toLowerCase() ?? "";
    const description = row.description?.toLowerCase() ?? "";
    return name.includes(q) || description.includes(q);
  });
}

export function intersectIds(currentIds: Set<string> | null, nextIds: string[]): Set<string> {
  const nextSet = new Set(nextIds);
  if (!currentIds) return nextSet;
  return new Set([...currentIds].filter((id) => nextSet.has(id)));
}

export function hasStructuralClauses(ast: AstClause[]): boolean {
  return ast.some((clause) => clause.kind !== "text");
}
