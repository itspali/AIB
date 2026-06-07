import type { CategoryRow } from "@/lib/categories/types";

function compareCategoryNames(a: CategoryRow, b: CategoryRow): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

export function upsertCategoryRow(rows: CategoryRow[], row: CategoryRow): CategoryRow[] {
  const index = rows.findIndex((entry) => entry.id === row.id);
  if (index === -1) {
    return [...rows, row].sort(compareCategoryNames);
  }
  return rows.map((entry) => (entry.id === row.id ? row : entry));
}

export function removeCategoryRow(rows: CategoryRow[], categoryId: string): CategoryRow[] {
  return rows.filter((row) => row.id !== categoryId);
}

export function patchCategoryActiveState(
  rows: CategoryRow[],
  categoryIds: string[],
  isActive: boolean
): CategoryRow[] {
  const idSet = new Set(categoryIds);
  return rows.map((row) => (idSet.has(row.id) ? { ...row, is_active: isActive } : row));
}
