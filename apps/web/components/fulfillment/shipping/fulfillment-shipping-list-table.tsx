"use client";

import { formatDate } from "@/lib/dashboard/format";
import { shippingCarrierLabel } from "@/lib/fulfillment/shipping/labels";
import type { SalesShipmentRow } from "@/lib/fulfillment/shipping/types";
import {
  ListWorkspaceRegistryHeaderCell,
  ListWorkspaceRegistryTableFrame,
} from "@/components/layout/list-workspace-registry-table";
import {
  LIST_TABLE_CELL_MONO_REF,
  LIST_TABLE_CELL_PRIMARY,
  LIST_TABLE_CELL_SECONDARY,
  LIST_TABLE_ROW_BASE,
  LIST_TABLE_CELL_HOVER,
  listTableElementClass,
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
    <ListWorkspaceRegistryTableFrame>
      <table className={listTableElementClass("wide")}>
        <thead>
          <tr>
            <ListWorkspaceRegistryHeaderCell label="Tracking" />
            <ListWorkspaceRegistryHeaderCell label="Sales order" />
            <ListWorkspaceRegistryHeaderCell label="Customer" />
            <ListWorkspaceRegistryHeaderCell label="Location" />
            <ListWorkspaceRegistryHeaderCell label="Carrier" />
            <ListWorkspaceRegistryHeaderCell label="Lines" align="right" />
            <ListWorkspaceRegistryHeaderCell label="Dispatched" />
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
    </ListWorkspaceRegistryTableFrame>
  );
}
