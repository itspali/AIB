"use client";

import type { ReactNode } from "react";
import { formatDate } from "@/lib/dashboard/format";
import { formatListQuantity } from "@/lib/list-columns/format-list-value";
import { booleanValueKey } from "@/lib/list-columns/chip-colors";
import { renderChipOrText } from "@/lib/list-columns/render-chip-value";
import type { ColumnChipDisplay } from "@/lib/list-columns/types";
import { getCategoryColumnDef, type CategoryListColumnId } from "@/lib/categories/list-columns";
import type { CategoryListRow } from "@/lib/categories/list-row";
import {
  LIST_TABLE_CELL_CHIP_FALLBACK,
  LIST_TABLE_CELL_COUNT,
  LIST_TABLE_CELL_DATE,
  LIST_TABLE_CELL_PRIMARY,
} from "@/lib/layout/list-table-chrome";
import { cn } from "@/lib/utils";

type CategoryListCellSurface = "list" | "matrix";

function isMatrixSurface(surface?: CategoryListCellSurface): boolean {
  return surface === "matrix";
}

function matrixCellEmpty(surface?: CategoryListCellSurface): ReactNode {
  return isMatrixSurface(surface) ? null : "—";
}

export function categoryListCellClassName(columnId: CategoryListColumnId): string {
  if (columnId === "name") return LIST_TABLE_CELL_PRIMARY;
  if (columnId === "parent_name") return "text-muted-foreground";
  if (columnId === "item_count" || columnId === "attribute_count") {
    return LIST_TABLE_CELL_COUNT;
  }
  return "";
}

type RenderCategoryListCellOptions = {
  chipDisplay?: Partial<Record<CategoryListColumnId, ColumnChipDisplay>>;
  surface?: CategoryListCellSurface;
};

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
    textNode: <span className={LIST_TABLE_CELL_CHIP_FALLBACK}>{label}</span>,
    chipDisplay: chipDisplay?.[columnId],
  });
}

export function renderCategoryListCell(
  columnId: CategoryListColumnId,
  row: CategoryListRow,
  options?: RenderCategoryListCellOptions
): ReactNode {
  const matrix = isMatrixSurface(options?.surface);

  switch (columnId) {
    case "name":
      return row.name;
    case "parent_name":
      return row.parent_name?.trim() ? row.parent_name : matrixCellEmpty(options?.surface);
    case "is_active": {
      const column = getCategoryColumnDef("is_active");
      const label = row.is_active ? "Active" : "Inactive";
      return renderChipOrText({
        column,
        valueKey: booleanValueKey(row.is_active),
        label,
        textNode: <span className={LIST_TABLE_CELL_CHIP_FALLBACK}>{label}</span>,
        chipDisplay: options?.chipDisplay?.is_active,
      });
    }
    case "item_count":
      return formatListQuantity(row.item_count);
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
      if (!raw) return matrixCellEmpty(options?.surface);
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
      return formatListQuantity(row.attribute_count);
    case "inherit_parent_attributes":
      return formatBooleanCell(
        "inherit_parent_attributes",
        row.inherit_parent_attributes,
        options?.chipDisplay
      );
    case "created_at":
      return matrix ? (
        formatDate(row.created_at)
      ) : (
        <span className={LIST_TABLE_CELL_DATE}>{formatDate(row.created_at)}</span>
      );
    case "updated_at":
      return matrix ? (
        formatDate(row.updated_at)
      ) : (
        <span className={LIST_TABLE_CELL_DATE}>{formatDate(row.updated_at)}</span>
      );
    default:
      return matrixCellEmpty(options?.surface);
  }
}

export function categoryListCellWrapClassName(_columnId: CategoryListColumnId): string {
  return cn("min-w-0 truncate");
}
