"use client";

import type { ReactNode } from "react";
import { formatDate } from "@/lib/dashboard/format";
import { formatListQuantity } from "@/lib/list-columns/format-list-value";
import {
  getTransferColumnDef,
  type TransferListColumnId,
} from "@/lib/inventory/transfers/list-columns";
import { stockTransferStatusLabel } from "@/lib/inventory/transfers/labels";
import { renderChipOrText } from "@/lib/list-columns/render-chip-value";
import type { ColumnChipDisplay } from "@/lib/list-columns/types";
import {
  LIST_TABLE_CELL_CHIP_FALLBACK,
  LIST_TABLE_CELL_COUNT,
  LIST_TABLE_CELL_DATE,
  LIST_TABLE_CELL_MONO_DOC,
  LIST_TABLE_CELL_SECONDARY,
  LIST_TABLE_CELL_SUBLINE,
} from "@/lib/layout/list-table-chrome";
import type { StockTransferRow } from "@/lib/inventory/transfers/types";

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
      return <div className={LIST_TABLE_CELL_MONO_DOC}>{row.transfer_number}</div>;
    case "from":
      return (
        <>
          <div className={LIST_TABLE_CELL_SECONDARY}>{row.source_location_name}</div>
          {row.source_location_code ? (
            <div className={LIST_TABLE_CELL_SUBLINE}>{row.source_location_code}</div>
          ) : null}
        </>
      );
    case "to":
      return (
        <>
          <div className={LIST_TABLE_CELL_SECONDARY}>{row.destination_location_name}</div>
          {row.destination_location_code ? (
            <div className={LIST_TABLE_CELL_SUBLINE}>{row.destination_location_code}</div>
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
        textNode: <span className={LIST_TABLE_CELL_CHIP_FALLBACK}>{label}</span>,
        chipDisplay: options?.chipDisplay?.status,
      });
    }
    case "lines":
      return <span className={LIST_TABLE_CELL_COUNT}>{formatListQuantity(row.line_count)}</span>;
    case "created":
      return (
        <span className={LIST_TABLE_CELL_DATE}>
          {formatDate(row.dispatched_at ?? row.created_at)}
        </span>
      );
    default:
      return null;
  }
}
