"use client";

import { Badge } from "@/components/ui/badge";
import { SoAddressBlocks } from "@/components/sales/orders/so-address-blocks";
import { SoFulfillmentSummary } from "@/components/sales/orders/so-fulfillment-summary";
import { SalesCustomerCreditPanel } from "@/components/sales/shared/sales-customer-credit-panel";
import { SalesCommercePeekLinesSection } from "@/components/sales/shared/sales-commerce-peek-lines-table";
import { formatDate } from "@/lib/dashboard/format";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";
import { DEFAULT_SALES_ORDER_SCREEN_LAYOUT } from "@/lib/sales/shared/sales-commerce-layout";
import { resolveSoAddressBlocks } from "@/lib/sales/orders/address-blocks";
import { parseSalesOrderCustomFields } from "@/lib/sales/orders/draft-form";
import {
  salesOrderStatusBadgeVariant,
  salesOrderStatusLabel,
} from "@/lib/sales/orders/labels";
import type { SalesOrderRow } from "@/lib/sales/orders/types";
import type { CustomerOption } from "@/lib/sales/shared/types";

type Props = {
  order: SalesOrderRow;
  layout?: DocumentLayoutTemplate;
  allowLineItemDiscounts?: boolean;
  customers?: CustomerOption[];
};

export function SoPeekView({
  order,
  layout = DEFAULT_SALES_ORDER_SCREEN_LAYOUT,
  allowLineItemDiscounts = true,
  customers = [],
}: Props) {
  const customFields = parseSalesOrderCustomFields(order.custom_fields);
  const addressBlocks = resolveSoAddressBlocks(order);
  const customer = customers.find((row) => row.id === order.customer_id);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            SO number
          </p>
          <p className="font-mono text-sm font-medium">{order.voucher_number}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Status
          </p>
          <Badge variant={salesOrderStatusBadgeVariant(order.commercial_status)}>
            {salesOrderStatusLabel(order.commercial_status)}
          </Badge>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Customer
          </p>
          <p className="text-sm font-medium">{order.customer_name}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Ship from
          </p>
          <p className="text-sm font-medium">{order.shipping_location_name}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Created
          </p>
          <p className="text-sm">{formatDate(order.created_at)}</p>
        </div>
      </div>

      <SoAddressBlocks blocks={addressBlocks} />

      {customer ? (
        <SalesCustomerCreditPanel
          customer={customer}
          orderNetAmount={Number(order.total_net_amount) || 0}
        />
      ) : null}

      {customFields.customer_po_number ||
      customFields.requested_ship_date ||
      customFields.internal_notes ? (
        <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-4 sm:grid-cols-2">
          {customFields.customer_po_number ? (
            <div>
              <p className="text-xs text-muted-foreground">Customer PO</p>
              <p className="text-sm">{customFields.customer_po_number}</p>
            </div>
          ) : null}
          {customFields.requested_ship_date ? (
            <div>
              <p className="text-xs text-muted-foreground">Requested ship date</p>
              <p className="text-sm">{customFields.requested_ship_date}</p>
            </div>
          ) : null}
          {customFields.internal_notes ? (
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">Internal notes</p>
              <p className="text-sm whitespace-pre-wrap">{customFields.internal_notes}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {order.lines?.length ? (
        <SalesCommercePeekLinesSection
          lines={order.lines}
          layout={layout}
          quantityField="quantity_ordered"
          lineTotalField="line_total_gross"
          grandTotal={order.total_net_amount}
          allowLineItemDiscounts={allowLineItemDiscounts}
        />
      ) : null}

      {order.lines?.length &&
      (order.commercial_status === "APPROVED_ACTIVE" ||
        order.commercial_status === "PARTIALLY_SHIPPED" ||
        order.commercial_status === "FULLY_COMPLETED") ? (
        <SoFulfillmentSummary lines={order.lines} />
      ) : null}
    </div>
  );
}
