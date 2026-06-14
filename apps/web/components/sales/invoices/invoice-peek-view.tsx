"use client";

import { Badge } from "@/components/ui/badge";
import {
  DocumentLinePeekItemCell,
  DocumentLinePeekTable,
  DocumentLinePeekValueCell,
} from "@/components/documents/document-line-peek-table";
import {
  salesInvoicePaymentStatusLabel,
  salesInvoiceStatusLabel,
} from "@/lib/sales/invoices/labels";
import type { SalesInvoiceRow } from "@/lib/sales/invoices/types";

type Props = {
  invoice: SalesInvoiceRow;
};

export function InvoicePeekView({ invoice }: Props) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Invoice number</p>
          <p className="font-mono text-sm font-medium">{invoice.invoice_number}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Status</p>
          <Badge variant="administrative" className="mt-0.5 text-xs font-normal">
            {salesInvoiceStatusLabel(invoice.commercial_status)}
          </Badge>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Payment</p>
          <Badge variant="administrative" className="mt-0.5 text-xs font-normal">
            {salesInvoicePaymentStatusLabel(invoice.invoice_payment_status)}
          </Badge>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Customer</p>
          <p className="text-sm font-medium">{invoice.customer_name}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Sales order</p>
          <p className="font-mono text-sm">{invoice.source_order_number ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Net amount</p>
          <p className="text-sm font-medium">{invoice.total_net_amount}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Paid</p>
          <p className="text-sm font-medium">{invoice.total_paid_amount}</p>
        </div>
      </div>

      {invoice.lines?.length ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Lines
          </p>
          <DocumentLinePeekTable
            lines={invoice.lines}
            getRowKey={(line) => line.id}
            columns={[
              { id: "item", label: "Item", align: "left" },
              { id: "quantity", label: "Qty", align: "right", widthClass: "w-[4.5rem]" },
              { id: "unit_price", label: "Unit price", align: "right", widthClass: "w-[4.5rem]" },
              { id: "line_total", label: "Line total", align: "right", widthClass: "w-[4.5rem]" },
            ]}
            renderCell={(column, line) => {
              if (column.id === "item") {
                return (
                  <DocumentLinePeekItemCell
                    itemName={line.item_name ?? "Item"}
                    variantSku={line.variant_sku ?? ""}
                  />
                );
              }
              if (column.id === "quantity") {
                return <DocumentLinePeekValueCell value={line.quantity_invoiced} />;
              }
              if (column.id === "unit_price") {
                return <DocumentLinePeekValueCell value={line.unit_price_selling} />;
              }
              return <DocumentLinePeekValueCell value={line.line_total_net} />;
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
