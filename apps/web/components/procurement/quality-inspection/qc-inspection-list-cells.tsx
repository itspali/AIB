"use client";

import type { ReactNode } from "react";
import { formatDate } from "@/lib/dashboard/format";
import {
  LIST_TABLE_CELL_COUNT,
  LIST_TABLE_CELL_DATE,
  LIST_TABLE_CELL_MONO_DOC,
  LIST_TABLE_CELL_MONO_REF,
  LIST_TABLE_CELL_SECONDARY,
  LIST_TABLE_CELL_SUBLINE,
} from "@/lib/layout/list-table-chrome";
import type { QcQueueListColumnId } from "@/lib/procurement/quality-inspection/list-columns";
import type { QcInspectionQueueRow } from "@/lib/procurement/quality-inspection/types";

export function renderQcInspectionListCell(
  columnId: QcQueueListColumnId,
  row: QcInspectionQueueRow
): ReactNode {
  switch (columnId) {
    case "item":
      return (
        <>
          <div className={LIST_TABLE_CELL_SECONDARY}>{row.item_name}</div>
          <div className={LIST_TABLE_CELL_SUBLINE}>{row.variant_sku}</div>
        </>
      );
    case "grn_number":
      return <span className={LIST_TABLE_CELL_MONO_DOC}>{row.grn_number}</span>;
    case "purchase_order":
      return <span className={LIST_TABLE_CELL_MONO_REF}>{row.purchase_order_number ?? "—"}</span>;
    case "location":
      return (
        <>
          <div className={LIST_TABLE_CELL_SECONDARY}>{row.destination_location_name}</div>
          {row.destination_location_code ? (
            <div className={LIST_TABLE_CELL_SUBLINE}>{row.destination_location_code}</div>
          ) : null}
        </>
      );
    case "on_hold":
      return <span className={LIST_TABLE_CELL_COUNT}>{row.quantity_on_hold}</span>;
    case "received":
      return <span className={LIST_TABLE_CELL_DATE}>{formatDate(row.received_at)}</span>;
    default:
      return null;
  }
}
