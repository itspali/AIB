import type { EntityCategoryRow } from "@/lib/entity-categories/types";

export type EntityCategoryListRow = EntityCategoryRow & {
  parent_name: string;
  entity_count: number;
  attribute_count: number;
};

export function enrichEntityCategoryListRows(
  rows: EntityCategoryRow[],
  allRows: EntityCategoryRow[],
  entityCountByCategoryId: Record<string, number> = {}
): EntityCategoryListRow[] {
  const byId = new Map(allRows.map((row) => [row.id, row]));
  return rows.map((row) => ({
    ...row,
    parent_name: row.parent_id ? (byId.get(row.parent_id)?.name ?? "—") : "—",
    entity_count: entityCountByCategoryId[row.id] ?? 0,
    attribute_count: row.attribute_templates.length,
  }));
}
