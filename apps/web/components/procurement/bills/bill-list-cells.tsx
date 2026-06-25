"use client";

import type { ReactNode } from "react";
import { formatDate } from "@/lib/dashboard/format";
import { formatListCurrency } from "@/lib/list-columns/format-list-value";
import { booleanValueKey } from "@/lib/list-columns/chip-colors";
import {
  getPurchaseBillColumnDef,
  type PurchaseBillListColumnId,
} from "@/lib/procurement/bills/list-columns";
import { billMatchStatusLabel } from "@/lib/procurement/bills/three-way-match";
import { renderChipOrText } from "@/lib/list-columns/render-chip-value";
import type { ColumnChipDisplay } from "@/lib/list-columns/types";
import {
  LIST_TABLE_CELL_AMOUNT,
  LIST_TABLE_CELL_CHIP_FALLBACK,
  LIST_TABLE_CELL_DATE,
  LIST_TABLE_CELL_MONO_DOC,
  LIST_TABLE_CELL_MONO_REF,
  LIST_TABLE_CELL_PRIMARY,
  LIST_TABLE_CELL_SECONDARY,
} from "@/lib/layout/list-table-chrome";
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
      return <span className={LIST_TABLE_CELL_MONO_DOC}>{row.system_voucher_number}</span>;
    case "invoice_number":
      return <span className={LIST_TABLE_CELL_SECONDARY}>{row.invoice_number_vendor}</span>;
    case "supplier":
      return <span className={LIST_TABLE_CELL_PRIMARY}>{row.supplier_name}</span>;
    case "purchase_order":
      return (
        <span className={LIST_TABLE_CELL_MONO_REF}>{row.purchase_order_number?.trim() || "—"}</span>
      );
    case "match_status": {
      const column = getPurchaseBillColumnDef("match_status");
      const status = row.match_status ?? "MATCHED";
      const label = billMatchStatusLabel(status);
      return renderChipOrText({
        column,
        valueKey: status,
        label,
        textNode: <span className={LIST_TABLE_CELL_CHIP_FALLBACK}>{label}</span>,
        chipDisplay: options?.chipDisplay?.match_status,
      });
    }
    case "liability":
      return <span className={LIST_TABLE_CELL_AMOUNT}>{formatListCurrency(row.total_liability_amount)}</span>;
    case "paid": {
      const column = getPurchaseBillColumnDef("paid");
      const label = row.is_paid ? "Paid" : "Unpaid";
      return renderChipOrText({
        column,
        valueKey: booleanValueKey(row.is_paid),
        label,
        textNode: <span className={LIST_TABLE_CELL_CHIP_FALLBACK}>{label}</span>,
        chipDisplay: options?.chipDisplay?.paid,
      });
    }
    case "created":
      return <span className={LIST_TABLE_CELL_DATE}>{formatDate(row.created_at)}</span>;
    default:
      return null;
  }
}
