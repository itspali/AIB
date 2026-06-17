"use client";

import { formatDate } from "@/lib/dashboard/format";
import { shippingCarrierLabel } from "@/lib/fulfillment/shipping/labels";
import type { SalesShipmentRow } from "@/lib/fulfillment/shipping/types";
import {
  LIST_TABLE_CELL_MONO_REF,
  LIST_TABLE_CELL_PRIMARY,
  LIST_TABLE_CELL_SECONDARY,
  LIST_TABLE_ROW_BASE,
  LIST_TABLE_CELL_HOVER,
} from "@/lib/layout/list-table-chrome";
import { cn } from "@/lib/utils";

type Props = {
  shipments: SalesShipmentRow[];
  selectedId: string | null;
  onSelect: (shipmentId: string) => void;
};

export function FulfillmentShippingListTable({ shipments, selectedId, onSelect }: Props) {
  if (shipments.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        No shipments yet. Ship a confirmed sales order to post outbound stock.
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full min-w-[48rem] text-sm">
        <thead className="sticky top-0 z-[1] bg-muted/95 text-xs uppercase text-muted-foreground backdrop-blur-sm">
          <tr>
            <th className="p-2 text-left">Tracking</th>
            <th className="p-2 text-left">Sales order</th>
            <th className="p-2 text-left">Customer</th>
            <th className="p-2 text-left">Location</th>
            <th className="p-2 text-left">Carrier</th>
            <th className="p-2 text-right">Lines</th>
            <th className="p-2 text-left">Dispatched</th>
          </tr>
        </thead>
        <tbody>
          {shipments.map((row) => (
            <tr
              key={row.id}
              className={cn(
                LIST_TABLE_ROW_BASE,
                "cursor-pointer border-b border-border",
                selectedId === row.id && "bg-accent/40"
              )}
              onClick={() => onSelect(row.id)}
            >
              <td className={cn("p-2", LIST_TABLE_CELL_HOVER)}>
                <span className={LIST_TABLE_CELL_MONO_REF}>{row.tracking_number}</span>
              </td>
              <td className={cn("p-2", LIST_TABLE_CELL_HOVER)}>
                <span className={LIST_TABLE_CELL_MONO_REF}>{row.sales_order_voucher}</span>
              </td>
              <td className={cn("p-2", LIST_TABLE_CELL_HOVER)}>
                <span className={LIST_TABLE_CELL_PRIMARY}>{row.customer_name}</span>
              </td>
              <td className={cn("p-2", LIST_TABLE_CELL_HOVER)}>
                <div className={LIST_TABLE_CELL_SECONDARY}>{row.origin_location_name}</div>
              </td>
              <td className={cn("p-2", LIST_TABLE_CELL_HOVER)}>
                {shippingCarrierLabel(row.carrier_provider)}
              </td>
              <td className={cn("p-2 text-right tabular-nums", LIST_TABLE_CELL_HOVER)}>
                {row.line_count}
              </td>
              <td className={cn("p-2", LIST_TABLE_CELL_HOVER)}>{formatDate(row.dispatched_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
