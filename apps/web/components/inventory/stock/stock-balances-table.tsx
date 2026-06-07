"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StockBalanceRow } from "@/lib/inventory/stock/types";
import { cn } from "@/lib/utils";

type Props = {
  rows: StockBalanceRow[];
  selectedId: string | null;
  onSelect?: (row: StockBalanceRow) => void;
  onAdjust?: (row: StockBalanceRow) => void;
};

export function StockBalancesTable({ rows, selectedId, onSelect, onAdjust }: Props) {
  return (
    <div className="surface-inset h-full min-h-0 overflow-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="sticky top-0 z-10 bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="p-2.5 font-medium">Location</th>
            <th className="p-2.5 font-medium">Item</th>
            <th className="p-2.5 font-medium">SKU</th>
            <th className="p-2.5 text-right font-medium">On hand</th>
            <th className="p-2.5 text-right font-medium">Avg cost</th>
            <th className="p-2.5 text-right font-medium">Reorder</th>
            {onAdjust ? <th className="p-2.5 text-right font-medium">Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const selected = selectedId === row.id;
            return (
              <tr
                key={row.id}
                className={cn(
                  "group box-border cursor-default border-b border-border transition-colors",
                  selected
                    ? "bg-primary/5 ring-1 ring-inset ring-primary/20"
                    : "hover:bg-muted/30"
                )}
                onClick={() => onSelect?.(row)}
              >
                <td className="p-2.5">
                  <div className="font-medium">{row.location_name}</div>
                  {row.location_code ? (
                    <div className="text-xs text-muted-foreground">{row.location_code}</div>
                  ) : null}
                </td>
                <td className="p-2.5">
                  <div className="font-medium">{row.item_name}</div>
                  {row.base_unit_of_measure ? (
                    <div className="text-xs text-muted-foreground">{row.base_unit_of_measure}</div>
                  ) : null}
                </td>
                <td className="p-2.5 font-mono text-xs">{row.variant_sku}</td>
                <td className="p-2.5 text-right tabular-nums">
                  <div className="inline-flex items-center justify-end gap-2">
                    <span className="font-medium">{row.total_quantity_on_hand}</span>
                    {row.below_reorder ? (
                      <Badge variant="action_required" className="text-[10px]">
                        Low
                      </Badge>
                    ) : null}
                  </div>
                </td>
                <td className="p-2.5 text-right tabular-nums">{row.current_average_cost}</td>
                <td className="p-2.5 text-right tabular-nums text-muted-foreground">
                  {row.reorder_point ?? "—"}
                </td>
                {onAdjust ? (
                  <td className="p-2.5 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7"
                      onClick={(event) => {
                        event.stopPropagation();
                        onAdjust(row);
                      }}
                    >
                      Adjust
                    </Button>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
