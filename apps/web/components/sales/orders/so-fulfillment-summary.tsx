"use client";

import type { SalesOrderLineRow } from "@/lib/sales/orders/types";

type Props = {
  lines: SalesOrderLineRow[];
};

export function SoFulfillmentSummary({ lines }: Props) {
  const trackedLines = lines.filter((line) => Number(line.quantity_ordered) > 0);
  if (trackedLines.length === 0) return null;

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Fulfillment
      </p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[28rem] text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-2 text-left">Item</th>
              <th className="p-2 text-right">Ordered</th>
              <th className="p-2 text-right">Reserved</th>
              <th className="p-2 text-right">Shipped</th>
              <th className="p-2 text-right">Open</th>
            </tr>
          </thead>
          <tbody>
            {trackedLines.map((line) => (
              <tr key={line.id} className="border-t border-border">
                <td className="p-2">
                  <div className="font-medium">{line.item_name}</div>
                  {line.variant_sku ? (
                    <div className="font-mono text-xs text-muted-foreground">{line.variant_sku}</div>
                  ) : null}
                </td>
                <td className="p-2 text-right tabular-nums">{line.quantity_ordered}</td>
                <td className="p-2 text-right tabular-nums">{line.quantity_allocated}</td>
                <td className="p-2 text-right tabular-nums">{line.quantity_shipped}</td>
                <td className="p-2 text-right tabular-nums">{line.open_quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
