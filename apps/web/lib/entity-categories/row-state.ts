import type { EntityCategoryRow } from "@/lib/entity-categories/types";

function compareCategoryNames(a: EntityCategoryRow, b: EntityCategoryRow): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

export function upsertEntityCategoryRow(
  rows: EntityCategoryRow[],
  row: EntityCategoryRow
): EntityCategoryRow[] {
  const index = rows.findIndex((entry) => entry.id === row.id);
  if (index === -1) {
    return [...rows, row].sort(compareCategoryNames);
  }
  return rows.map((entry) => (entry.id === row.id ? row : entry));
}

export function removeEntityCategoryRow(
  rows: EntityCategoryRow[],
  categoryId: string
): EntityCategoryRow[] {
  return rows.filter((row) => row.id !== categoryId);
}

export function patchEntityCategoryActiveState(
  rows: EntityCategoryRow[],
  categoryIds: string[],
  isActive: boolean
): EntityCategoryRow[] {
  const idSet = new Set(categoryIds);
  return rows.map((row) => (idSet.has(row.id) ? { ...row, is_active: isActive } : row));
}
