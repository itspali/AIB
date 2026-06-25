"use client";

import type { ReactNode } from "react";
import { SalesListDocumentRefLink } from "@/components/sales/shared/sales-list-document-ref-link";
import { formatDate } from "@/lib/dashboard/format";
import { formatListCurrency } from "@/lib/list-columns/format-list-value";
import { renderChipOrText } from "@/lib/list-columns/render-chip-value";
import type { ColumnChipDisplay } from "@/lib/list-columns/types";
import {
  getSalesInvoiceColumnDef,
  type SalesInvoiceListColumnId,
} from "@/lib/sales/invoices/list-columns";
import {
  salesInvoicePaymentStatusLabel,
  salesInvoiceStatusLabel,
} from "@/lib/sales/invoices/labels";
import {
  LIST_TABLE_CELL_AMOUNT,
  LIST_TABLE_CELL_CHIP_FALLBACK,
  LIST_TABLE_CELL_DATE,
  LIST_TABLE_CELL_MONO_DOC,
  LIST_TABLE_CELL_PRIMARY,
  LIST_TABLE_CELL_SECONDARY,
} from "@/lib/layout/list-table-chrome";
import { SALES_ORDERS_HREF, SALES_QUOTES_HREF } from "@/lib/sales/navigation";
import type { SalesInvoiceRow } from "@/lib/sales/invoices/types";

type Options = {
  chipDisplay?: Partial<Record<SalesInvoiceListColumnId, ColumnChipDisplay>>;
};

export function renderSalesInvoiceListCell(
  columnId: SalesInvoiceListColumnId,
  row: SalesInvoiceRow,
  options?: Options
): ReactNode {
  switch (columnId) {
    case "invoice_number":
      return <span className={LIST_TABLE_CELL_MONO_DOC}>{row.invoice_number}</span>;
    case "customer":
      return <span className={LIST_TABLE_CELL_PRIMARY}>{row.customer_name}</span>;
    case "origin_location":
      return <span className={LIST_TABLE_CELL_SECONDARY}>{row.origin_location_name || "—"}</span>;
    case "status": {
      const column = getSalesInvoiceColumnDef("status");
      const label = salesInvoiceStatusLabel(row.commercial_status);
      return renderChipOrText({
        column,
        valueKey: row.commercial_status,
        label,
        textNode: <span className={LIST_TABLE_CELL_CHIP_FALLBACK}>{label}</span>,
        chipDisplay: options?.chipDisplay?.status,
      });
    }
    case "payment_status": {
      const column = getSalesInvoiceColumnDef("payment_status");
      const label = salesInvoicePaymentStatusLabel(row.invoice_payment_status);
      return renderChipOrText({
        column,
        valueKey: row.invoice_payment_status,
        label,
        textNode: <span className={LIST_TABLE_CELL_CHIP_FALLBACK}>{label}</span>,
        chipDisplay: options?.chipDisplay?.payment_status,
      });
    }
    case "source_order":
      return (
        <SalesListDocumentRefLink
          documentId={row.source_order_id}
          documentNumber={row.source_order_number}
          moduleHref={SALES_ORDERS_HREF}
        />
      );
    case "source_quote":
      return (
        <SalesListDocumentRefLink
          documentId={row.source_quotation_id}
          documentNumber={row.source_quotation_number}
          moduleHref={SALES_QUOTES_HREF}
        />
      );
    case "net_amount":
      return <span className={LIST_TABLE_CELL_AMOUNT}>{formatListCurrency(row.total_net_amount)}</span>;
    case "paid_amount":
      return (
        <span className={LIST_TABLE_CELL_AMOUNT}>{formatListCurrency(row.total_paid_amount)}</span>
      );
    case "created":
      return <span className={LIST_TABLE_CELL_DATE}>{formatDate(row.created_at)}</span>;
    case "updated":
      return <span className={LIST_TABLE_CELL_DATE}>{formatDate(row.updated_at)}</span>;
    default:
      return null;
  }
}
