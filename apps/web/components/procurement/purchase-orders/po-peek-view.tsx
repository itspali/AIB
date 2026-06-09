"use client";

import { Badge } from "@/components/ui/badge";
import {
  isNarrowRightDrawer,
  useRightDrawerLayout,
} from "@/components/ui/right-drawer";
import { formatDate } from "@/lib/dashboard/format";
import {
  purchaseOrderStatusBadgeVariant,
  purchaseOrderStatusLabel,
} from "@/lib/procurement/purchase-orders/labels";
import { parsePurchaseOrderCustomFields } from "@/lib/procurement/purchase-orders/custom-fields";
import type { PurchaseOrderRow } from "@/lib/procurement/purchase-orders/types";
import { formatPoMoney } from "@/lib/procurement/purchase-orders/totals";
import { cn } from "@/lib/utils";

type Props = {
  order: PurchaseOrderRow;
};

export function PoPeekView({ order }: Props) {
  const drawerLayout = useRightDrawerLayout();
  const stackVertically = isNarrowRightDrawer(drawerLayout);
  const customFields = parsePurchaseOrderCustomFields(order.custom_fields);

  return (
    <div className="space-y-6">
      <div
        className={cn(
          "grid grid-cols-1 gap-4",
          !stackVertically && "sm:grid-cols-2 lg:grid-cols-3"
        )}
      >
        <div>
          <p className="text-xs font-medium text-muted-foreground">PO number</p>
          <p className="font-mono text-sm font-medium">{order.voucher_number}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Supplier</p>
          <p className="text-sm font-medium">{order.supplier_name}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Destination</p>
          <p className="text-sm font-medium">{order.destination_location_name}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Currency</p>
          <p className="text-sm font-medium">{order.currency_code}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Status</p>
          <Badge variant={purchaseOrderStatusBadgeVariant(order.document_status)}>
            {purchaseOrderStatusLabel(order.document_status)}
          </Badge>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Payment terms</p>
          <p className="text-sm">{order.payment_terms_days} days</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Updated</p>
          <p className="text-sm">{formatDate(order.updated_at)}</p>
        </div>
        {customFields.requisition_number ? (
          <div>
            <p className="text-xs font-medium text-muted-foreground">Requisition #</p>
            <p className="text-sm">{customFields.requisition_number}</p>
          </div>
        ) : null}
        {customFields.expected_delivery_date ? (
          <div>
            <p className="text-xs font-medium text-muted-foreground">Expected delivery</p>
            <p className="text-sm">{customFields.expected_delivery_date}</p>
          </div>
        ) : null}
      </div>

      {customFields.internal_notes ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground">Internal notes</p>
          <p className="text-sm">{customFields.internal_notes}</p>
        </div>
      ) : null}

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lines</p>
          <p className="text-sm font-semibold tabular-nums">
            Total {formatPoMoney(Number(order.total_net_amount) || 0)}
          </p>
        </div>
        <div className="po-peek-lines-table overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="sticky top-0 z-[5] w-10 bg-muted/95 p-2 text-center backdrop-blur-sm shadow-[inset_0_-1px_0_0_hsl(var(--border))] dark:bg-[hsl(224_47%_16%)]">
                  #
                </th>
                <th className="sticky top-0 z-[5] bg-muted/95 p-2 text-left backdrop-blur-sm shadow-[inset_0_-1px_0_0_hsl(var(--border))] dark:bg-[hsl(224_47%_16%)]">
                  Item
                </th>
                <th className="sticky top-0 z-[5] bg-muted/95 p-2 text-right backdrop-blur-sm shadow-[inset_0_-1px_0_0_hsl(var(--border))] dark:bg-[hsl(224_47%_16%)]">
                  Ordered
                </th>
                <th className="sticky top-0 z-[5] bg-muted/95 p-2 text-right backdrop-blur-sm shadow-[inset_0_-1px_0_0_hsl(var(--border))] dark:bg-[hsl(224_47%_16%)]">
                  Received
                </th>
                <th className="sticky top-0 z-[5] bg-muted/95 p-2 text-right backdrop-blur-sm shadow-[inset_0_-1px_0_0_hsl(var(--border))] dark:bg-[hsl(224_47%_16%)]">
                  Unit price
                </th>
                <th className="sticky top-0 z-[5] bg-muted/95 p-2 text-right backdrop-blur-sm shadow-[inset_0_-1px_0_0_hsl(var(--border))] dark:bg-[hsl(224_47%_16%)]">
                  Line total
                </th>
              </tr>
            </thead>
            <tbody>
              {(order.lines ?? []).map((line, lineIndex) => (
                <tr key={line.id} className="border-b border-border">
                  <td className="w-10 p-2 text-center tabular-nums text-xs text-muted-foreground">
                    {lineIndex + 1}
                  </td>
                  <td className="p-2">
                    <div className="text-xs font-medium">{line.item_name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{line.variant_sku}</div>
                  </td>
                  <td className="p-2 text-right tabular-nums">{line.quantity_ordered}</td>
                  <td className="p-2 text-right tabular-nums">{line.quantity_received}</td>
                  <td className="p-2 text-right tabular-nums">{line.unit_price_contractual}</td>
                  <td className="p-2 text-right tabular-nums">{line.line_total_gross}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
