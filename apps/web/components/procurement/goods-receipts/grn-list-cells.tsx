"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/dashboard/format";
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
          <span className="font-mono text-xs font-medium">{row.voucher_number}</span>
          {row.is_qc_pending ? (
            <Badge variant="action_required" className="text-[10px]">
              QC
            </Badge>
          ) : null}
        </div>
      );
    case "location":
      return (
        <>
          <div className="font-medium">{row.destination_location_name}</div>
          {row.destination_location_code ? (
            <div className="text-xs text-muted-foreground">{row.destination_location_code}</div>
          ) : null}
        </>
      );
    case "purchase_order":
      return (
        <span className="font-mono text-xs">{row.purchase_order_number ?? "—"}</span>
      );
    case "lines":
      return <span className="tabular-nums">{row.line_count}</span>;
    case "received":
      return <span className="text-sm text-muted-foreground">{formatDate(row.received_at)}</span>;
    default:
      return null;
  }
}
