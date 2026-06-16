"use client";

import type { ReactNode } from "react";
import { formatDate } from "@/lib/dashboard/format";
import { booleanValueKey } from "@/lib/list-columns/chip-colors";
import { renderChipOrText } from "@/lib/list-columns/render-chip-value";
import type { ColumnChipDisplay } from "@/lib/list-columns/types";
import {
  getEntityCategoryColumnDef,
  type EntityCategoryListColumnId,
} from "@/lib/entity-categories/list-columns";
import type { EntityCategoryListRow } from "@/lib/entity-categories/list-row";
import type { EntityCategoryWorkspace } from "@/lib/entity-categories/types";
import {
  LIST_TABLE_CELL_CHIP_FALLBACK,
  LIST_TABLE_CELL_COUNT,
  LIST_TABLE_CELL_DATE,
  LIST_TABLE_CELL_PRIMARY,
} from "@/lib/layout/list-table-chrome";
import { cn } from "@/lib/utils";

export function entityCategoryListCellClassName(
  columnId: EntityCategoryListColumnId
): string {
  if (columnId === "name") return LIST_TABLE_CELL_PRIMARY;
  if (columnId === "parent_name") return "text-muted-foreground";
  if (columnId === "entity_count" || columnId === "attribute_count") {
    return LIST_TABLE_CELL_COUNT;
  }
  return "";
}

type RenderOptions = {
  workspace: EntityCategoryWorkspace;
  chipDisplay?: Partial<Record<EntityCategoryListColumnId, ColumnChipDisplay>>;
};

function formatBooleanCell(
  workspace: EntityCategoryWorkspace,
  columnId: EntityCategoryListColumnId,
  value: boolean,
  chipDisplay?: Partial<Record<EntityCategoryListColumnId, ColumnChipDisplay>>
): ReactNode {
  const column = getEntityCategoryColumnDef(workspace, columnId);
  const label = value ? "Yes" : "No";
  return renderChipOrText({
    column,
    valueKey: booleanValueKey(value),
    label,
    textNode: <span className={LIST_TABLE_CELL_CHIP_FALLBACK}>{label}</span>,
    chipDisplay: chipDisplay?.[columnId],
  });
}

export function renderEntityCategoryListCell(
  columnId: EntityCategoryListColumnId,
  row: EntityCategoryListRow,
  options: RenderOptions
): ReactNode {
  const { workspace, chipDisplay } = options;

  switch (columnId) {
    case "name":
      return row.name;
    case "parent_name":
      return row.parent_name;
    case "is_active": {
      const column = getEntityCategoryColumnDef(workspace, "is_active");
      const label = row.is_active ? "Active" : "Inactive";
      return renderChipOrText({
        column,
        valueKey: booleanValueKey(row.is_active),
        label,
        textNode: <span className={LIST_TABLE_CELL_CHIP_FALLBACK}>{label}</span>,
        chipDisplay: chipDisplay?.is_active,
      });
    }
    case "entity_count":
      return row.entity_count;
    case "attribute_count":
      return row.attribute_count;
    case "inherit_parent_attributes":
      return formatBooleanCell(
        workspace,
        "inherit_parent_attributes",
        row.inherit_parent_attributes,
        chipDisplay
      );
    case "created_at":
      return <span className={LIST_TABLE_CELL_DATE}>{formatDate(row.created_at)}</span>;
    case "updated_at":
      return <span className={LIST_TABLE_CELL_DATE}>{formatDate(row.updated_at)}</span>;
    default:
      return "—";
  }
}

export function entityCategoryListCellWrapClassName(
  _columnId: EntityCategoryListColumnId
): string {
  return cn("min-w-0 truncate");
}
