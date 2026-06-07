"use client";

import type { ReactNode } from "react";
import { formatDate } from "@/lib/dashboard/format";
import { booleanValueKey } from "@/lib/list-columns/chip-colors";
import { renderChipOrText } from "@/lib/list-columns/render-chip-value";
import type { ColumnChipDisplay } from "@/lib/list-columns/types";
import { getCategoryColumnDef, type CategoryListColumnId } from "@/lib/categories/list-columns";
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

type RenderCategoryListCellOptions = {
  chipDisplay?: Partial<Record<CategoryListColumnId, ColumnChipDisplay>>;
};

function formatActiveStatusText(value: boolean): ReactNode {
  return (
    <span
      className={cn(
        "text-xs font-medium",
        value ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
      )}
    >
      {value ? "Active" : "Inactive"}
    </span>
  );
}

function formatBooleanCell(
  columnId: CategoryListColumnId,
  value: boolean,
  chipDisplay?: Partial<Record<CategoryListColumnId, ColumnChipDisplay>>
): ReactNode {
  const column = getCategoryColumnDef(columnId);
  const label = value ? "Yes" : "No";
  return renderChipOrText({
    column,
    valueKey: booleanValueKey(value),
    label,
    textNode: (
      <span
        className={cn(
          "text-xs font-medium",
          value ? "text-emerald-600" : "text-muted-foreground"
        )}
      >
        {label}
      </span>
    ),
    chipDisplay: chipDisplay?.[columnId],
  });
}

export function renderCategoryListCell(
  columnId: CategoryListColumnId,
  row: CategoryListRow,
  options?: RenderCategoryListCellOptions
): ReactNode {
  switch (columnId) {
    case "name":
      return row.name;
    case "parent_name":
      return row.parent_name;
    case "is_active": {
      const column = getCategoryColumnDef("is_active");
      const label = row.is_active ? "Active" : "Inactive";
      return renderChipOrText({
        column,
        valueKey: booleanValueKey(row.is_active),
        label,
        textNode: formatActiveStatusText(row.is_active),
        chipDisplay: options?.chipDisplay?.is_active,
      });
    }
    case "item_count":
      return row.item_count;
    case "default_variant_strategy": {
      const column = getCategoryColumnDef("default_variant_strategy");
      const label = row.default_variant_strategy.replace(/_/g, " ");
      return renderChipOrText({
        column,
        valueKey: row.default_variant_strategy,
        label,
        textNode: label,
        chipDisplay: options?.chipDisplay?.default_variant_strategy,
      });
    }
    case "default_item_type": {
      const column = getCategoryColumnDef("default_item_type");
      const raw = row.default_item_type;
      if (!raw) return "—";
      const label = raw.replace(/_/g, " ");
      return renderChipOrText({
        column,
        valueKey: raw,
        label,
        textNode: label,
        chipDisplay: options?.chipDisplay?.default_item_type,
      });
    }
    case "attribute_count":
      return row.attribute_count;
    case "inherit_parent_attributes":
      return formatBooleanCell(
        "inherit_parent_attributes",
        row.inherit_parent_attributes,
        options?.chipDisplay
      );
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
