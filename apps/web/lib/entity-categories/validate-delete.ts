import type { EntityCategoryRow } from "@/lib/entity-categories/types";

export type EntityCategoryDeleteBlocker =
  | { kind: "entities"; count: number }
  | { kind: "children"; count: number };

export function countChildEntityCategories(categoryId: string, rows: EntityCategoryRow[]): number {
  return rows.filter((row) => row.parent_id === categoryId).length;
}

export function getEntityCategoryDeleteBlockers(
  categoryId: string,
  rows: EntityCategoryRow[],
  entityCountByCategoryId: Record<string, number> = {}
): EntityCategoryDeleteBlocker[] {
  const blockers: EntityCategoryDeleteBlocker[] = [];

  const entityCount = entityCountByCategoryId[categoryId] ?? 0;
  if (entityCount > 0) {
    blockers.push({ kind: "entities", count: entityCount });
  }

  const childCount = countChildEntityCategories(categoryId, rows);
  if (childCount > 0) {
    blockers.push({ kind: "children", count: childCount });
  }

  return blockers;
}

export function entityCategoryDeleteBlockedMessage(
  blockers: EntityCategoryDeleteBlocker[]
): string {
  const parts = blockers.map((blocker) => {
    if (blocker.kind === "entities") {
      const noun = blocker.count === 1 ? "entity is" : "entities are";
      return `${blocker.count} ${noun} assigned to this category`;
    }
    const noun = blocker.count === 1 ? "child category exists" : "child categories exist";
    return `${blocker.count} ${noun} under this category`;
  });

  if (parts.length === 0) return "";
  return `Cannot delete: ${parts.join("; ")}. Reassign entities or move/delete child categories first.`;
}

export function entityCategoryDeleteBlockedWithInactiveHint(
  blockers: EntityCategoryDeleteBlocker[],
  alreadyInactive: boolean
): string {
  const base = entityCategoryDeleteBlockedMessage(blockers);
  if (alreadyInactive) {
    return `${base} This category is already inactive and hidden from entity pickers.`;
  }
  return `${base} You can mark it inactive instead to hide it from new entity pickers while keeping existing assignments.`;
}

export function entityCategoryDeactivateConfirmMessage(categoryName: string): string {
  return `"${categoryName}" will be marked inactive and hidden from entity pickers. Existing entities keep this category.`;
}

export function entityCategoryDeleteConfirmMessage(categoryName: string): string {
  return `"${categoryName}" will be permanently removed. This cannot be undone.`;
}
