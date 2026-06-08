import type { EntityListRow } from "@/lib/entities/types";

function compareEntityNames(a: EntityListRow, b: EntityListRow): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

export function upsertEntityRow(rows: EntityListRow[], row: EntityListRow): EntityListRow[] {
  const index = rows.findIndex((entry) => entry.id === row.id);
  if (index === -1) {
    return [...rows, row].sort(compareEntityNames);
  }
  return rows.map((entry) => (entry.id === row.id ? row : entry));
}

export function removeEntityRow(rows: EntityListRow[], entityId: string): EntityListRow[] {
  return rows.filter((row) => row.id !== entityId);
}

export function patchEntityActiveState(
  rows: EntityListRow[],
  entityIds: string[],
  isActive: boolean
): EntityListRow[] {
  const idSet = new Set(entityIds);
  return rows.map((row) => (idSet.has(row.id) ? { ...row, is_active: isActive } : row));
}
