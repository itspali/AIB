"use client";

import type { ReactNode } from "react";
import { formatDate } from "@/lib/dashboard/format";
import { getUomColumnDef, type UomListColumnId } from "@/lib/uom/list-columns";
import { formatUomFactorSummary } from "@/lib/uom/list-column-display-text";
import { renderChipOrText } from "@/lib/list-columns/render-chip-value";
import type { ColumnChipDisplay } from "@/lib/list-columns/types";
import {
  LIST_TABLE_CELL_AMOUNT,
  LIST_TABLE_CELL_DATE,
  LIST_TABLE_CELL_MONO_REF,
  LIST_TABLE_CELL_PRIMARY,
} from "@/lib/layout/list-table-chrome";
import { uomFamilyLabel, type UomRow } from "@/lib/uom/types";

type Options = {
  chipDisplay?: Partial<Record<UomListColumnId, ColumnChipDisplay>>;
};

export function renderUomListCell(
  columnId: UomListColumnId,
  row: UomRow,
  options?: Options
): ReactNode {
  switch (columnId) {
    case "code":
      return <span className={LIST_TABLE_CELL_MONO_REF}>{row.code}</span>;
    case "name":
      return <div className={LIST_TABLE_CELL_PRIMARY}>{row.name}</div>;
    case "family": {
      const column = getUomColumnDef("family");
      const label = uomFamilyLabel(row.family);
      return renderChipOrText({
        column,
        valueKey: row.family,
        label,
        textNode: <span>{label}</span>,
        chipDisplay: options?.chipDisplay?.family,
      });
    }
    case "factor_to_base":
      return (
        <span className={LIST_TABLE_CELL_AMOUNT}>{formatUomFactorSummary(row)}</span>
      );
    case "is_family_base": {
      const column = getUomColumnDef("is_family_base");
      const label = row.is_family_base ? "Yes" : "No";
      return renderChipOrText({
        column,
        valueKey: String(row.is_family_base),
        label,
        textNode: <span>{label}</span>,
        chipDisplay: options?.chipDisplay?.is_family_base,
      });
    }
    case "is_active": {
      const column = getUomColumnDef("is_active");
      const label = row.is_active ? "Active" : "Inactive";
      return renderChipOrText({
        column,
        valueKey: String(row.is_active),
        label,
        textNode: <span>{label}</span>,
        chipDisplay: options?.chipDisplay?.is_active,
      });
    }
    case "updated_at":
      return <span className={LIST_TABLE_CELL_DATE}>{formatDate(row.updated_at)}</span>;
    default:
      return null;
  }
}
