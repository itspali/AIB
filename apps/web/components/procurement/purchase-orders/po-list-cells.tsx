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
import type { PurchaseOrderRow } from "@/lib/procurement/purchase-orders/types";
import { cn } from "@/lib/utils";

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
      return <div className="font-mono text-xs font-medium">{row.voucher_number}</div>;
    case "supplier":
      return <span className="font-medium">{row.supplier_name}</span>;
    case "destination":
      return (
        <>
          <div className="font-medium">{row.destination_location_name}</div>
          {row.destination_location_code ? (
            <div className="text-xs text-muted-foreground">{row.destination_location_code}</div>
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
        textNode: <span className="text-sm font-medium">{label}</span>,
        chipDisplay: options?.chipDisplay?.status,
      });
    }
    case "lines":
      return <span className="tabular-nums">{row.line_count}</span>;
    case "net_amount":
      return <span className="tabular-nums">{row.total_net_amount}</span>;
    case "created":
      return (
        <span className={cn("text-sm text-muted-foreground")}>{formatDate(row.created_at)}</span>
      );
    case "created_by":
      return <span className="text-sm">{row.created_by_name?.trim() || "—"}</span>;
    case "updated":
      return (
        <span className={cn("text-sm text-muted-foreground")}>{formatDate(row.updated_at)}</span>
      );
    default:
      return null;
  }
}
