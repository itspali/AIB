import type { CategoryRow } from "@/lib/categories/types";

export type CategoryDeleteBlocker =
  | { kind: "items"; count: number }
  | { kind: "children"; count: number };

export function countChildCategories(categoryId: string, rows: CategoryRow[]): number {
  return rows.filter((row) => row.parent_id === categoryId).length;
}

export function getCategoryDeleteBlockers(
  categoryId: string,
  rows: CategoryRow[],
  itemCountByCategoryId: Record<string, number> = {}
): CategoryDeleteBlocker[] {
  const blockers: CategoryDeleteBlocker[] = [];

  const itemCount = itemCountByCategoryId[categoryId] ?? 0;
  if (itemCount > 0) {
    blockers.push({ kind: "items", count: itemCount });
  }

  const childCount = countChildCategories(categoryId, rows);
  if (childCount > 0) {
    blockers.push({ kind: "children", count: childCount });
  }

  return blockers;
}

export function categoryDeleteBlockedMessage(blockers: CategoryDeleteBlocker[]): string {
  const parts = blockers.map((blocker) => {
    if (blocker.kind === "items") {
      const noun = blocker.count === 1 ? "item is" : "items are";
      return `${blocker.count} ${noun} assigned to this category`;
    }
    const noun = blocker.count === 1 ? "child category exists" : "child categories exist";
    return `${blocker.count} ${noun} under this category`;
  });

  if (parts.length === 0) return "";
  return `Cannot delete: ${parts.join("; ")}. Reassign items or move/delete child categories first.`;
}

export function categoryDeleteBlockedWithInactiveHint(
  blockers: CategoryDeleteBlocker[],
  alreadyInactive: boolean
): string {
  const base = categoryDeleteBlockedMessage(blockers);
  if (alreadyInactive) {
    return `${base} This category is already inactive and hidden from item pickers.`;
  }
  return `${base} You can mark it inactive instead to hide it from new item pickers while keeping existing assignments.`;
}

export function categoryDeactivateConfirmMessage(categoryName: string): string {
  return `"${categoryName}" will be marked inactive and hidden from item pickers. Existing items keep this category.`;
}

export function categoryDeleteConfirmMessage(categoryName: string): string {
  return `"${categoryName}" will be permanently removed. This cannot be undone.`;
}
