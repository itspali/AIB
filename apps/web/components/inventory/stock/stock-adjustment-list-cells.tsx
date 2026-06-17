"use client";

import type { ReactNode } from "react";
import { formatDate } from "@/lib/dashboard/format";
import {
  getStockAdjustmentColumnDef,
  type StockAdjustmentColumnId,
} from "@/lib/inventory/stock/list-columns";
import { stockAdjustmentKindLabel } from "@/lib/inventory/stock/labels";
import { renderChipOrText } from "@/lib/list-columns/render-chip-value";
import type { ColumnChipDisplay } from "@/lib/list-columns/types";
import {
  LIST_TABLE_CELL_CHIP_FALLBACK,
  LIST_TABLE_CELL_COUNT,
  LIST_TABLE_CELL_DATE,
  LIST_TABLE_CELL_MONO_DOC,
  LIST_TABLE_CELL_PRIMARY,
  LIST_TABLE_CELL_SECONDARY,
  LIST_TABLE_CELL_SUBLINE,
} from "@/lib/layout/list-table-chrome";
import type { StockAdjustmentRow } from "@/lib/inventory/stock/types";
import { cn } from "@/lib/utils";

type Options = {
  chipDisplay?: Partial<Record<StockAdjustmentColumnId, ColumnChipDisplay>>;
};

export function renderStockAdjustmentListCell(
  columnId: StockAdjustmentColumnId,
  row: StockAdjustmentRow,
  options?: Options
): ReactNode {
  switch (columnId) {
    case "document":
      return <div className={LIST_TABLE_CELL_MONO_DOC}>{row.adjustment_number}</div>;
    case "location":
      return (
        <>
          <div className={LIST_TABLE_CELL_PRIMARY}>{row.location_name}</div>
          {row.location_code ? (
            <div className={LIST_TABLE_CELL_SUBLINE}>{row.location_code}</div>
          ) : null}
        </>
      );
    case "kind": {
      const column = getStockAdjustmentColumnDef("kind");
      const label = stockAdjustmentKindLabel(row.kind);
      return renderChipOrText({
        column,
        valueKey: row.kind,
        label,
        textNode: <span className={LIST_TABLE_CELL_CHIP_FALLBACK}>{label}</span>,
        chipDisplay: options?.chipDisplay?.kind,
      });
    }
    case "reason":
      return <div className={cn("line-clamp-2", LIST_TABLE_CELL_SECONDARY)}>{row.reason}</div>;
    case "lines":
      return <span className={LIST_TABLE_CELL_COUNT}>{row.line_count}</span>;
    case "posted":
      return <span className={LIST_TABLE_CELL_DATE}>{formatDate(row.posted_at)}</span>;
    default:
      return null;
  }
}
