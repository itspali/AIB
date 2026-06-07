"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  buildReorderAdjustHref,
  buildReorderTransferHref,
} from "@/lib/inventory/overview/reorder-links";
import type { BelowReorderOverviewRow } from "@/lib/inventory/overview/types";
import { STOCK_HREF } from "@/lib/inventory/stock/navigation";

type Props = {
  rows: BelowReorderOverviewRow[];
  totalCount: number;
};

export function InventoryBelowReorderSection({ rows, totalCount }: Props) {
  if (totalCount === 0) return null;

  return (
    <section aria-label="Below reorder balances" className="mb-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Below reorder
          </h2>
        </div>
        <Link href={STOCK_HREF} className="text-sm font-medium text-primary hover:underline">
          View all balances
        </Link>
      </div>

      <div className="surface-inset overflow-auto rounded-lg">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="p-2.5 font-medium">Location</th>
              <th className="p-2.5 font-medium">Item</th>
              <th className="p-2.5 font-medium">SKU</th>
              <th className="p-2.5 text-right font-medium">On hand</th>
              <th className="p-2.5 text-right font-medium">Reorder</th>
              <th className="p-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-b-0">
                <td className="p-2.5">
                  <div className="font-medium">{row.location_name}</div>
                  {row.location_code ? (
                    <div className="text-xs text-muted-foreground">{row.location_code}</div>
                  ) : null}
                </td>
                <td className="p-2.5 font-medium">{row.item_name}</td>
                <td className="p-2.5 font-mono text-xs">{row.variant_sku}</td>
                <td className="p-2.5 text-right tabular-nums font-medium">
                  {row.total_quantity_on_hand}
                </td>
                <td className="p-2.5 text-right tabular-nums text-muted-foreground">
                  {row.reorder_point ?? "—"}
                </td>
                <td className="p-2.5">
                  <div className="flex justify-end gap-2">
                    <Button asChild variant="outline" size="sm" className="h-7">
                      <Link
                        href={buildReorderAdjustHref({
                          variantId: row.variant_id,
                          locationId: row.location_id,
                        })}
                      >
                        Adjust
                      </Link>
                    </Button>
                    <Button asChild size="sm" className="h-7">
                      <Link
                        href={buildReorderTransferHref({
                          variantId: row.variant_id,
                          destinationLocationId: row.location_id,
                          sourceLocationId: row.suggested_source_location_id,
                        })}
                        title={
                          row.suggested_source_location_name
                            ? `Transfer from ${row.suggested_source_location_name}`
                            : "Create a transfer to this location"
                        }
                      >
                        Transfer
                      </Link>
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalCount > rows.length ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Showing {rows.length} of {totalCount} below-reorder balances.
        </p>
      ) : null}
    </section>
  );
}
