"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/dashboard/format";
import type { CategoryListColumnId } from "@/lib/categories/list-columns";
import type { CategoryListRow } from "@/lib/categories/list-row";
import { cn } from "@/lib/utils";

export function categoryListCellClassName(columnId: CategoryListColumnId): string {
  if (columnId === "name") return "font-medium";
  if (columnId === "parent_name") return "text-muted-foreground";
  if (columnId === "item_count" || columnId === "attribute_count") {
    return "tabular-nums text-muted-foreground";
  }
  return "";
}

export function renderCategoryListCell(
  columnId: CategoryListColumnId,
  row: CategoryListRow
): ReactNode {
  switch (columnId) {
    case "name":
      return row.name;
    case "parent_name":
      return row.parent_name;
    case "is_active":
      return (
        <Badge variant={row.is_active ? "completed" : "locked"}>
          {row.is_active ? "Active" : "Inactive"}
        </Badge>
      );
    case "item_count":
      return row.item_count;
    case "default_variant_strategy":
      return row.default_variant_strategy.replace(/_/g, " ");
    case "default_item_type":
      return row.default_item_type?.replace(/_/g, " ") ?? "—";
    case "attribute_count":
      return row.attribute_count;
    case "inherit_parent_attributes":
      return row.inherit_parent_attributes ? "Yes" : "No";
    case "created_at":
      return formatDate(row.created_at);
    case "updated_at":
      return formatDate(row.updated_at);
    default:
      return "—";
  }
}

export function categoryListCellWrapClassName(_columnId: CategoryListColumnId): string {
  return cn("min-w-0 truncate");
}
