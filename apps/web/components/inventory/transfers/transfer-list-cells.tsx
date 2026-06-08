"use client";

import type { ReactNode } from "react";
import { formatDate } from "@/lib/dashboard/format";
import {
  getTransferColumnDef,
  type TransferListColumnId,
} from "@/lib/inventory/transfers/list-columns";
import { stockTransferStatusLabel } from "@/lib/inventory/transfers/labels";
import { renderChipOrText } from "@/lib/list-columns/render-chip-value";
import type { ColumnChipDisplay } from "@/lib/list-columns/types";
import type { StockTransferRow } from "@/lib/inventory/transfers/types";
import { cn } from "@/lib/utils";

function statusTextTone(status: StockTransferRow["current_status"]): string {
  switch (status) {
    case "DISPATCHED_IN_TRANSIT":
      return "text-amber-700 dark:text-amber-300";
    case "FULLY_COMPLETED":
      return "text-emerald-700 dark:text-emerald-300";
    case "RECEIPT_DISCREPANCY":
      return "text-rose-700 dark:text-rose-300";
    case "CANCELLED":
      return "text-muted-foreground line-through";
    default:
      return "text-muted-foreground";
  }
}

type Options = {
  chipDisplay?: Partial<Record<TransferListColumnId, ColumnChipDisplay>>;
};

export function renderTransferListCell(
  columnId: TransferListColumnId,
  row: StockTransferRow,
  options?: Options
): ReactNode {
  switch (columnId) {
    case "document":
      return <div className="font-mono text-xs font-medium">{row.transfer_number}</div>;
    case "from":
      return (
        <>
          <div className="font-medium">{row.source_location_name}</div>
          {row.source_location_code ? (
            <div className="text-xs text-muted-foreground">{row.source_location_code}</div>
          ) : null}
        </>
      );
    case "to":
      return (
        <>
          <div className="font-medium">{row.destination_location_name}</div>
          {row.destination_location_code ? (
            <div className="text-xs text-muted-foreground">{row.destination_location_code}</div>
          ) : null}
        </>
      );
    case "status": {
      const column = getTransferColumnDef("status");
      const label = stockTransferStatusLabel(row.current_status);
      return renderChipOrText({
        column,
        valueKey: row.current_status,
        label,
        textNode: (
          <span className={cn("text-sm font-medium", statusTextTone(row.current_status))}>
            {label}
          </span>
        ),
        chipDisplay: options?.chipDisplay?.status,
      });
    }
    case "lines":
      return <span className="tabular-nums">{row.line_count}</span>;
    case "created":
      return (
        <span className="text-sm text-muted-foreground">
          {formatDate(row.dispatched_at ?? row.created_at)}
        </span>
      );
    default:
      return null;
  }
}
