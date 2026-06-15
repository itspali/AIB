"use client";

import { Badge } from "@/components/ui/badge";
import { SalesCommerceAddressBlocks } from "@/components/sales/shared/sales-commerce-address-blocks";
import { SalesCommercePeekLinesSection } from "@/components/sales/shared/sales-commerce-peek-lines-table";
import { formatDate } from "@/lib/dashboard/format";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";
import { DEFAULT_SALES_QUOTATION_SCREEN_LAYOUT } from "@/lib/sales/shared/sales-commerce-layout";
import { resolveSalesCommerceAddressBlocks } from "@/lib/sales/shared/resolve-sales-address-blocks";
import { salesQuoteStatusLabel } from "@/lib/sales/quotes/labels";
import type { SalesQuoteRow } from "@/lib/sales/quotes/types";
import type { CustomerOption, SalesLocationOption } from "@/lib/sales/shared/types";

type Props = {
  quote: SalesQuoteRow;
  layout?: DocumentLayoutTemplate;
  allowLineItemDiscounts?: boolean;
  customers?: CustomerOption[];
  locations?: SalesLocationOption[];
};

export function QuotePeekView({
  quote,
  layout = DEFAULT_SALES_QUOTATION_SCREEN_LAYOUT,
  allowLineItemDiscounts = true,
  customers = [],
  locations = [],
}: Props) {
  const customer = customers.find((row) => row.id === quote.customer_id);
  const addressBlocks = resolveSalesCommerceAddressBlocks({
    customer,
    billing_state: quote.billing_state,
    shipping_state: quote.shipping_state,
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Quote number</p>
          <p className="font-mono text-sm font-medium">{quote.quotation_number}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Status</p>
          <Badge variant="administrative" className="mt-0.5 text-xs font-normal">
            {salesQuoteStatusLabel(quote.commercial_status)}
          </Badge>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Customer</p>
          <p className="text-sm font-medium">{quote.customer_name}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Valid until</p>
          <p className="text-sm">{formatDate(quote.valid_until)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Origin</p>
          <p className="text-sm">{quote.origin_location_name || "—"}</p>
        </div>
      </div>

      {addressBlocks.length > 0 ? <SalesCommerceAddressBlocks blocks={addressBlocks} /> : null}

      {quote.lines?.length ? (
        <SalesCommercePeekLinesSection
          lines={quote.lines}
          layout={layout}
          quantityField="quantity_quoted"
          lineTotalField="line_total_gross"
          grandTotal={quote.total_net_amount}
          allowLineItemDiscounts={allowLineItemDiscounts}
        />
      ) : null}
    </div>
  );
}
