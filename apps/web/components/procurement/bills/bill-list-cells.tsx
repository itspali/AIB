"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/dashboard/format";
import {
  getPurchaseBillColumnDef,
  type PurchaseBillListColumnId,
} from "@/lib/procurement/bills/list-columns";
import { billMatchStatusLabel } from "@/lib/procurement/bills/three-way-match";
import { renderChipOrText } from "@/lib/list-columns/render-chip-value";
import type { ColumnChipDisplay } from "@/lib/list-columns/types";
import type { PurchaseBillRow } from "@/lib/procurement/bills/types";

type Options = {
  chipDisplay?: Partial<Record<PurchaseBillListColumnId, ColumnChipDisplay>>;
};

export function renderPurchaseBillListCell(
  columnId: PurchaseBillListColumnId,
  row: PurchaseBillRow,
  options?: Options
): ReactNode {
  switch (columnId) {
    case "bill_number":
      return <span className="font-mono text-xs font-medium">{row.system_voucher_number}</span>;
    case "invoice_number":
      return <span className="font-medium">{row.invoice_number_vendor}</span>;
    case "supplier":
      return <span className="font-medium">{row.supplier_name}</span>;
    case "purchase_order":
      return (
        <span className="font-mono text-xs">{row.purchase_order_number?.trim() || "—"}</span>
      );
    case "match_status": {
      const column = getPurchaseBillColumnDef("match_status");
      const status = row.match_status ?? "MATCHED";
      const label = billMatchStatusLabel(status);
      return renderChipOrText({
        column,
        valueKey: status,
        label,
        textNode: <span className="text-sm font-medium">{label}</span>,
        chipDisplay: options?.chipDisplay?.match_status,
      });
    }
    case "liability":
      return <span className="tabular-nums">{row.total_liability_amount}</span>;
    case "paid":
      return row.is_paid ? (
        <Badge variant="completed" className="text-[10px] font-normal">
          Paid
        </Badge>
      ) : (
        <Badge variant="administrative" className="text-[10px] font-normal">
          Unpaid
        </Badge>
      );
    case "created":
      return <span className="text-sm text-muted-foreground">{formatDate(row.created_at)}</span>;
    default:
      return null;
  }
}
