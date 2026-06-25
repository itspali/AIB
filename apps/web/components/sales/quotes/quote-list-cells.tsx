"use client";

import type { ReactNode } from "react";
import { SalesListDocumentRefLink } from "@/components/sales/shared/sales-list-document-ref-link";
import { formatDate } from "@/lib/dashboard/format";
import { formatListCurrency, formatListQuantity } from "@/lib/list-columns/format-list-value";
import { renderChipOrText } from "@/lib/list-columns/render-chip-value";
import type { ColumnChipDisplay } from "@/lib/list-columns/types";
import {
  getSalesQuoteColumnDef,
  type SalesQuoteListColumnId,
} from "@/lib/sales/quotes/list-columns";
import {
  salesQuoteDisplayStatusLabel,
  salesQuoteStatusLabel,
} from "@/lib/sales/quotes/labels";
import {
  LIST_TABLE_CELL_AMOUNT,
  LIST_TABLE_CELL_CHIP_FALLBACK,
  LIST_TABLE_CELL_COUNT,
  LIST_TABLE_CELL_DATE,
  LIST_TABLE_CELL_MONO_DOC,
  LIST_TABLE_CELL_PRIMARY,
  LIST_TABLE_CELL_SECONDARY,
} from "@/lib/layout/list-table-chrome";
import { SALES_INVOICES_HREF, SALES_ORDERS_HREF } from "@/lib/sales/navigation";
import type { SalesQuoteRow } from "@/lib/sales/quotes/types";

type Options = {
  chipDisplay?: Partial<Record<SalesQuoteListColumnId, ColumnChipDisplay>>;
};

export function renderSalesQuoteListCell(
  columnId: SalesQuoteListColumnId,
  row: SalesQuoteRow,
  options?: Options
): ReactNode {
  switch (columnId) {
    case "quote_number":
      return <span className={LIST_TABLE_CELL_MONO_DOC}>{row.quotation_number}</span>;
    case "customer":
      return <span className={LIST_TABLE_CELL_PRIMARY}>{row.customer_name}</span>;
    case "origin_location":
      return <span className={LIST_TABLE_CELL_SECONDARY}>{row.origin_location_name || "—"}</span>;
    case "status": {
      const column = getSalesQuoteColumnDef("status");
      const statusKey = row.sent_at ? "SENT" : row.commercial_status;
      const label = salesQuoteDisplayStatusLabel(row);
      return renderChipOrText({
        column,
        valueKey: statusKey,
        label,
        textNode: <span className={LIST_TABLE_CELL_CHIP_FALLBACK}>{label}</span>,
        chipDisplay: options?.chipDisplay?.status,
      });
    }
    case "sent_at":
      return (
        <span className={LIST_TABLE_CELL_DATE}>
          {row.sent_at ? formatDate(row.sent_at) : "—"}
        </span>
      );
    case "valid_until":
      return <span className={LIST_TABLE_CELL_DATE}>{formatDate(row.valid_until)}</span>;
    case "converted_order":
      return (
        <SalesListDocumentRefLink
          documentId={row.converted_to_order_id}
          documentNumber={row.converted_to_order_number}
          moduleHref={SALES_ORDERS_HREF}
        />
      );
    case "converted_invoice":
      return (
        <SalesListDocumentRefLink
          documentId={row.converted_to_invoice_id}
          documentNumber={row.converted_to_invoice_number}
          moduleHref={SALES_INVOICES_HREF}
        />
      );
    case "lines":
      return <span className={LIST_TABLE_CELL_COUNT}>{formatListQuantity(row.line_count)}</span>;
    case "net_amount":
      return <span className={LIST_TABLE_CELL_AMOUNT}>{formatListCurrency(row.total_net_amount)}</span>;
    case "created":
      return <span className={LIST_TABLE_CELL_DATE}>{formatDate(row.created_at)}</span>;
    case "updated":
      return <span className={LIST_TABLE_CELL_DATE}>{formatDate(row.updated_at)}</span>;
    default:
      return null;
  }
}
