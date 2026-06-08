import { formatDate } from "@/lib/dashboard/format";
import type { CategoryListColumnId } from "@/lib/categories/list-columns";
import type { CategoryListRow } from "@/lib/categories/list-row";

export function getCategoryListCellDisplayTexts(
  columnId: CategoryListColumnId,
  row: CategoryListRow
): string[] {
  switch (columnId) {
    case "name":
      return [row.name?.trim() || "—"];
    case "parent_name":
      return [row.parent_name?.trim() || "—"];
    case "is_active":
      return [row.is_active ? "Active" : "Inactive"];
    case "item_count":
    case "attribute_count":
      return [String(row[columnId])];
    case "default_variant_strategy":
      return [row.default_variant_strategy.replace(/_/g, " ")];
    case "default_item_type":
      return [row.default_item_type ? row.default_item_type.replace(/_/g, " ") : "—"];
    case "inherit_parent_attributes":
      return [row.inherit_parent_attributes ? "Yes" : "No"];
    case "created_at":
    case "updated_at":
      return [formatDate(row[columnId])];
    default:
      return ["—"];
  }
}
