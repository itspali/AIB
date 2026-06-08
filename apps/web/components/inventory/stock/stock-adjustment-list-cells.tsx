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
import type { StockAdjustmentRow } from "@/lib/inventory/stock/types";

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
      return <div className="font-mono text-xs font-medium">{row.adjustment_number}</div>;
    case "location":
      return (
        <>
          <div className="font-medium">{row.location_name}</div>
          {row.location_code ? (
            <div className="text-xs text-muted-foreground">{row.location_code}</div>
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
        textNode: <span>{label}</span>,
        chipDisplay: options?.chipDisplay?.kind,
      });
    }
    case "reason":
      return <div className="line-clamp-2">{row.reason}</div>;
    case "lines":
      return <span className="tabular-nums">{row.line_count}</span>;
    case "posted":
      return <span className="text-muted-foreground">{formatDate(row.posted_at)}</span>;
    default:
      return null;
  }
}
