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
import { cn } from "@/lib/utils";

export function entityCategoryListCellClassName(
  columnId: EntityCategoryListColumnId
): string {
  if (columnId === "name") return "font-medium";
  if (columnId === "parent_name") return "text-muted-foreground";
  if (columnId === "entity_count" || columnId === "attribute_count") {
    return "tabular-nums text-muted-foreground";
  }
  return "";
}

type RenderOptions = {
  workspace: EntityCategoryWorkspace;
  chipDisplay?: Partial<Record<EntityCategoryListColumnId, ColumnChipDisplay>>;
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
        textNode: formatActiveStatusText(row.is_active),
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
      return formatDate(row.created_at);
    case "updated_at":
      return formatDate(row.updated_at);
    default:
      return "—";
  }
}

export function entityCategoryListCellWrapClassName(
  _columnId: EntityCategoryListColumnId
): string {
  return cn("min-w-0 truncate");
}
