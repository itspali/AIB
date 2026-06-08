"use client";

import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/dashboard/format";
import {
  purchaseOrderStatusBadgeVariant,
  purchaseOrderStatusLabel,
} from "@/lib/procurement/purchase-orders/labels";
import type { PurchaseOrderRow } from "@/lib/procurement/purchase-orders/types";
import { cn } from "@/lib/utils";

type Props = {
  rows: PurchaseOrderRow[];
  selectedId: string | null;
  onSelect: (purchaseOrderId: string) => void;
};

export function PoListTable({ rows, selectedId, onSelect }: Props) {
  return (
    <div className="surface-inset h-full min-h-0 overflow-auto">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="sticky top-0 z-10 bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="p-2.5 font-medium">PO number</th>
            <th className="p-2.5 font-medium">Supplier</th>
            <th className="p-2.5 font-medium">Destination</th>
            <th className="p-2.5 font-medium">Status</th>
            <th className="p-2.5 text-right font-medium">Lines</th>
            <th className="p-2.5 text-right font-medium">Net amount</th>
            <th className="p-2.5 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const selected = selectedId === row.id;
            return (
              <tr
                key={row.id}
                className={cn(
                  "group box-border cursor-pointer border-b border-border transition-colors",
                  selected
                    ? "bg-primary/5 ring-1 ring-inset ring-primary/20"
                    : "hover:bg-muted/30"
                )}
                onClick={() => onSelect(row.id)}
              >
                <td className="p-2.5">
                  <div className="font-mono text-xs font-medium">{row.voucher_number}</div>
                </td>
                <td className="p-2.5 font-medium">{row.supplier_name}</td>
                <td className="p-2.5">
                  <div className="font-medium">{row.destination_location_name}</div>
                  {row.destination_location_code ? (
                    <div className="text-xs text-muted-foreground">
                      {row.destination_location_code}
                    </div>
                  ) : null}
                </td>
                <td className="p-2.5">
                  <Badge variant={purchaseOrderStatusBadgeVariant(row.document_status)}>
                    {purchaseOrderStatusLabel(row.document_status)}
                  </Badge>
                </td>
                <td className="p-2.5 text-right tabular-nums">{row.line_count}</td>
                <td className="p-2.5 text-right tabular-nums">{row.total_net_amount}</td>
                <td className="p-2.5 text-sm text-muted-foreground">
                  {formatDate(row.updated_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
