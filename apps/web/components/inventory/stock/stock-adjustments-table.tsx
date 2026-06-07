"use client";

import { stockAdjustmentKindLabel } from "@/lib/inventory/stock/labels";
import { formatDate } from "@/lib/dashboard/format";
import type { StockAdjustmentRow } from "@/lib/inventory/stock/types";
import { cn } from "@/lib/utils";

type Props = {
  rows: StockAdjustmentRow[];
  selectedId: string | null;
  onSelect: (adjustmentId: string) => void;
};

export function StockAdjustmentsTable({ rows, selectedId, onSelect }: Props) {
  return (
    <div className="surface-inset h-full min-h-0 overflow-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="sticky top-0 z-10 bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="p-2.5 font-medium">Document</th>
            <th className="p-2.5 font-medium">Location</th>
            <th className="p-2.5 font-medium">Kind</th>
            <th className="p-2.5 font-medium">Reason</th>
            <th className="p-2.5 text-right font-medium">Lines</th>
            <th className="p-2.5 font-medium">Posted</th>
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
                  <div className="font-mono text-xs font-medium">{row.adjustment_number}</div>
                </td>
                <td className="p-2.5">
                  <div className="font-medium">{row.location_name}</div>
                  {row.location_code ? (
                    <div className="text-xs text-muted-foreground">{row.location_code}</div>
                  ) : null}
                </td>
                <td className="p-2.5 text-sm">{stockAdjustmentKindLabel(row.kind)}</td>
                <td className="p-2.5">
                  <div className="line-clamp-2">{row.reason}</div>
                </td>
                <td className="p-2.5 text-right tabular-nums">{row.line_count}</td>
                <td className="p-2.5 text-sm text-muted-foreground">{formatDate(row.posted_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
