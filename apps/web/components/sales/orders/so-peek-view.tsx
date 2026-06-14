"use client";

import { Badge } from "@/components/ui/badge";
import { SoAddressBlocks } from "@/components/sales/orders/so-address-blocks";
import { formatDate } from "@/lib/dashboard/format";
import { parseSalesOrderCustomFields } from "@/lib/sales/orders/draft-form";
import {
  salesOrderStatusBadgeVariant,
  salesOrderStatusLabel,
} from "@/lib/sales/orders/labels";
import { resolveSoAddressBlocks } from "@/lib/sales/orders/address-blocks";
import type { SalesOrderRow } from "@/lib/sales/orders/types";

type Props = {
  order: SalesOrderRow;
};

export function SoPeekView({ order }: Props) {
  const customFields = parseSalesOrderCustomFields(order.custom_fields);
  const addressBlocks = resolveSoAddressBlocks(order);

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
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Net amount
          </p>
          <p className="text-sm tabular-nums font-medium">{order.total_net_amount}</p>
        </div>
      </div>

      <SoAddressBlocks blocks={addressBlocks} />

      {customFields.customer_po_number || customFields.requested_ship_date || customFields.internal_notes ? (
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
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-right">Discount</th>
                <th className="px-3 py-2 text-right">Tax</th>
                <th className="px-3 py-2 text-right">Line total</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((line) => (
                <tr key={line.id} className="border-b border-border/70">
                  <td className="px-3 py-2">
                    <div className="font-medium">{line.item_name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{line.variant_sku}</div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{line.quantity_ordered}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{line.unit_price_selling}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {line.discount_percentage}% / {line.discount_amount}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{line.line_tax_amount}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{line.line_total_gross}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
