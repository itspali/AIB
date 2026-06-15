"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SalesCommerceAddressBlocks } from "@/components/sales/shared/sales-commerce-address-blocks";
import { SalesCommercePeekLinesSection } from "@/components/sales/shared/sales-commerce-peek-lines-table";
import {
  SALES_ORDERS_HREF,
  SALES_QUOTES_HREF,
} from "@/lib/sales/navigation";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";
import { DEFAULT_SALES_INVOICE_SCREEN_LAYOUT } from "@/lib/sales/shared/sales-commerce-layout";
import { resolveSalesCommerceAddressBlocks } from "@/lib/sales/shared/resolve-sales-address-blocks";
import {
  salesInvoicePaymentStatusLabel,
  salesInvoiceStatusLabel,
} from "@/lib/sales/invoices/labels";
import type { SalesInvoiceRow } from "@/lib/sales/invoices/types";
import type { CustomerOption, SalesLocationOption } from "@/lib/sales/shared/types";

type Props = {
  invoice: SalesInvoiceRow;
  layout?: DocumentLayoutTemplate;
  allowLineItemDiscounts?: boolean;
  customers?: CustomerOption[];
  locations?: SalesLocationOption[];
};

export function InvoicePeekView({
  invoice,
  layout = DEFAULT_SALES_INVOICE_SCREEN_LAYOUT,
  allowLineItemDiscounts = true,
  customers = [],
  locations = [],
}: Props) {
  const customer = customers.find((row) => row.id === invoice.customer_id);
  const addressBlocks = resolveSalesCommerceAddressBlocks({
    customer,
    billing_state: invoice.billing_state,
    shipping_state: invoice.shipping_state,
  });

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
          {invoice.source_order_id && invoice.source_order_number ? (
            <Button type="button" size="sm" variant="ghost" className="h-auto p-0 font-mono text-sm text-primary" asChild>
              <Link href={`${SALES_ORDERS_HREF}?id=${encodeURIComponent(invoice.source_order_id)}`}>
                {invoice.source_order_number}
              </Link>
            </Button>
          ) : (
            <p className="font-mono text-sm">—</p>
          )}
        </div>
        {invoice.source_quotation_id && invoice.source_quotation_number ? (
          <div>
            <p className="text-xs font-medium text-muted-foreground">Source quote</p>
            <Button type="button" size="sm" variant="ghost" className="h-auto p-0 font-mono text-sm text-primary" asChild>
              <Link
                href={`${SALES_QUOTES_HREF}?id=${encodeURIComponent(invoice.source_quotation_id)}`}
              >
                {invoice.source_quotation_number}
              </Link>
            </Button>
          </div>
        ) : null}
        <div>
          <p className="text-xs font-medium text-muted-foreground">Paid</p>
          <p className="text-sm font-medium tabular-nums">{invoice.total_paid_amount}</p>
        </div>
      </div>

      {addressBlocks.length > 0 ? <SalesCommerceAddressBlocks blocks={addressBlocks} /> : null}

      {invoice.lines?.length ? (
        <SalesCommercePeekLinesSection
          lines={invoice.lines}
          layout={layout}
          quantityField="quantity_invoiced"
          lineTotalField="line_total_net"
          grandTotal={invoice.total_net_amount}
          allowLineItemDiscounts={allowLineItemDiscounts}
        />
      ) : null}
    </div>
  );
}
