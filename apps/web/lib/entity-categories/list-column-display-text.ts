import { formatDate } from "@/lib/dashboard/format";
import type { EntityCategoryListColumnId } from "@/lib/entity-categories/list-columns";
import type { EntityCategoryListRow } from "@/lib/entity-categories/list-row";

export function getEntityCategoryListCellDisplayTexts(
  columnId: EntityCategoryListColumnId,
  row: EntityCategoryListRow
): string[] {
  switch (columnId) {
    case "name":
      return [row.name?.trim() || "—"];
    case "parent_name":
      return [row.parent_name?.trim() || "—"];
    case "is_active":
      return [row.is_active ? "Active" : "Inactive"];
    case "entity_count":
    case "attribute_count":
      return [String(row[columnId])];
    case "inherit_parent_attributes":
      return [row.inherit_parent_attributes ? "Yes" : "No"];
    case "created_at":
    case "updated_at":
      return [formatDate(row[columnId])];
    default:
      return ["—"];
  }
}
