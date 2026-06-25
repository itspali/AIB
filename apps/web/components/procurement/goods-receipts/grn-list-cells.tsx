"use client";

import type { ReactNode } from "react";
import { FieldValueChip } from "@/components/list-columns/field-value-chip";
import { formatDate } from "@/lib/dashboard/format";
import { formatListQuantity } from "@/lib/list-columns/format-list-value";
import {
  LIST_TABLE_CELL_COUNT,
  LIST_TABLE_CELL_DATE,
  LIST_TABLE_CELL_MONO_DOC,
  LIST_TABLE_CELL_MONO_REF,
  LIST_TABLE_CELL_SECONDARY,
  LIST_TABLE_CELL_SUBLINE,
} from "@/lib/layout/list-table-chrome";
import type { GoodsReceiptListColumnId } from "@/lib/procurement/goods-receipts/list-columns";
import type { GoodsReceiptRow } from "@/lib/procurement/goods-receipts/types";

export function renderGoodsReceiptListCell(
  columnId: GoodsReceiptListColumnId,
  row: GoodsReceiptRow
): ReactNode {
  switch (columnId) {
    case "grn_number":
      return (
        <div className="inline-flex items-center gap-2">
          <span className={LIST_TABLE_CELL_MONO_DOC}>{row.voucher_number}</span>
          {row.is_qc_pending ? (
            <FieldValueChip label="QC" colorRule={{ preset: "amber" }} />
          ) : null}
        </div>
      );
    case "location":
      return (
        <>
          <div className={LIST_TABLE_CELL_SECONDARY}>{row.destination_location_name}</div>
          {row.destination_location_code ? (
            <div className={LIST_TABLE_CELL_SUBLINE}>{row.destination_location_code}</div>
          ) : null}
        </>
      );
    case "purchase_order":
      return <span className={LIST_TABLE_CELL_MONO_REF}>{row.purchase_order_number ?? "—"}</span>;
    case "lines":
      return <span className={LIST_TABLE_CELL_COUNT}>{formatListQuantity(row.line_count)}</span>;
    case "received":
      return <span className={LIST_TABLE_CELL_DATE}>{formatDate(row.received_at)}</span>;
    default:
      return null;
  }
}
