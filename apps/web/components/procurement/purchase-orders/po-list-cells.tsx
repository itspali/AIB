"use client";

import type { ReactNode } from "react";
import { formatDate } from "@/lib/dashboard/format";
import {
  getPurchaseOrderColumnDef,
  type PurchaseOrderListColumnId,
} from "@/lib/procurement/purchase-orders/list-columns";
import { purchaseOrderStatusLabel } from "@/lib/procurement/purchase-orders/labels";
import { renderChipOrText } from "@/lib/list-columns/render-chip-value";
import type { ColumnChipDisplay } from "@/lib/list-columns/types";
import {
  LIST_TABLE_CELL_AMOUNT,
  LIST_TABLE_CELL_CHIP_FALLBACK,
  LIST_TABLE_CELL_COUNT,
  LIST_TABLE_CELL_DATE,
  LIST_TABLE_CELL_MONO_DOC,
  LIST_TABLE_CELL_PRIMARY,
  LIST_TABLE_CELL_SECONDARY,
  LIST_TABLE_CELL_SUBLINE,
} from "@/lib/layout/list-table-chrome";
import type { PurchaseOrderRow } from "@/lib/procurement/purchase-orders/types";

type Options = {
  chipDisplay?: Partial<Record<PurchaseOrderListColumnId, ColumnChipDisplay>>;
};

export function renderPurchaseOrderListCell(
  columnId: PurchaseOrderListColumnId,
  row: PurchaseOrderRow,
  options?: Options
): ReactNode {
  switch (columnId) {
    case "po_number":
      return <div className={LIST_TABLE_CELL_MONO_DOC}>{row.voucher_number}</div>;
    case "supplier":
      return <span className={LIST_TABLE_CELL_PRIMARY}>{row.supplier_name}</span>;
    case "destination":
      return (
        <>
          <div className={LIST_TABLE_CELL_SECONDARY}>{row.destination_location_name}</div>
          {row.destination_location_code ? (
            <div className={LIST_TABLE_CELL_SUBLINE}>{row.destination_location_code}</div>
          ) : null}
        </>
      );
    case "status": {
      const column = getPurchaseOrderColumnDef("status");
      const label = purchaseOrderStatusLabel(row.document_status);
      return renderChipOrText({
        column,
        valueKey: row.document_status,
        label,
        textNode: <span className={LIST_TABLE_CELL_CHIP_FALLBACK}>{label}</span>,
        chipDisplay: options?.chipDisplay?.status,
      });
    }
    case "lines":
      return <span className={LIST_TABLE_CELL_COUNT}>{row.line_count}</span>;
    case "net_amount":
      return <span className={LIST_TABLE_CELL_AMOUNT}>{row.total_net_amount}</span>;
    case "created":
      return <span className={LIST_TABLE_CELL_DATE}>{formatDate(row.created_at)}</span>;
    case "created_by":
      return <span className={LIST_TABLE_CELL_SECONDARY}>{row.created_by_name?.trim() || "—"}</span>;
    case "updated":
      return <span className={LIST_TABLE_CELL_DATE}>{formatDate(row.updated_at)}</span>;
    default:
      return null;
  }
}
