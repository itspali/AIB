"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Boxes, ClipboardList, Package } from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { stockAdjustmentKindLabel } from "@/lib/inventory/stock/labels";
import { STOCK_HREF } from "@/lib/inventory/stock/navigation";
import { TRANSFERS_HREF } from "@/lib/inventory/transfers/navigation";
import type { InventoryOverviewSnapshot } from "@/lib/inventory/overview/types";
import { formatCurrency, formatDate } from "@/lib/dashboard/format";
import { Button } from "@/components/ui/button";

type Props = {
  snapshot: InventoryOverviewSnapshot;
};

const ITEMS_HREF = "/inventory/items";
const CATEGORIES_HREF = "/inventory/categories";

export function InventoryOverviewTerminal({ snapshot }: Props) {
  return (
    <div className="canvas-scroll-endpad">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Track on-hand balances, move stock between locations, and manage your product catalog.
          </p>
        </div>
        <Button asChild>
          <Link href={`${STOCK_HREF}?action=new`}>New adjustment</Link>
        </Button>
      </div>

      <section aria-label="Inventory summary" className="mb-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <MetricCard
            title="Inventory valuation"
            value={formatCurrency(snapshot.inventoryValuation)}
            subtitle="On-hand quantity × average cost across stocked locations"
            icon={Boxes}
            accent="emerald"
          />
          <MetricCard
            title="Below reorder"
            value={String(snapshot.belowReorderCount)}
            subtitle="Variant×location balances at or below their reorder threshold"
            icon={AlertTriangle}
            accent="amber"
          />
          <MetricCard
            title="Stocked balances"
            value={String(snapshot.stockedBalanceCount)}
            subtitle="Active balances with quantity on hand greater than zero"
            icon={Package}
            accent="cyan"
          />
        </div>
      </section>

      <section aria-label="Quick links" className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Modules
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href={STOCK_HREF}
            className="surface-panel flex items-center justify-between gap-3 rounded-lg p-4 transition-colors hover:bg-muted/30"
          >
            <div>
              <div className="font-medium">Stock</div>
              <div className="text-sm text-muted-foreground">Balances and adjustments</div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
          <Link
            href={TRANSFERS_HREF}
            className="surface-panel flex items-center justify-between gap-3 rounded-lg p-4 transition-colors hover:bg-muted/30"
          >
            <div>
              <div className="font-medium">Transfers</div>
              <div className="text-sm text-muted-foreground">Move stock between locations</div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
          <Link
            href={ITEMS_HREF}
            className="surface-panel flex items-center justify-between gap-3 rounded-lg p-4 transition-colors hover:bg-muted/30"
          >
            <div>
              <div className="font-medium">Items</div>
              <div className="text-sm text-muted-foreground">Product master catalog</div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
          <Link
            href={CATEGORIES_HREF}
            className="surface-panel flex items-center justify-between gap-3 rounded-lg p-4 transition-colors hover:bg-muted/30"
          >
            <div>
              <div className="font-medium">Categories</div>
              <div className="text-sm text-muted-foreground">Catalog taxonomy</div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </div>
      </section>

      <section aria-label="Recent stock adjustments">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground" aria-hidden />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Recent adjustments
            </h2>
          </div>
          <Link
            href={STOCK_HREF}
            className="text-sm font-medium text-primary hover:underline"
          >
            View all
          </Link>
        </div>

        {snapshot.recentAdjustments.length === 0 ? (
          <div className="surface-inset rounded-lg px-4 py-8 text-center text-sm text-muted-foreground">
            No stock adjustments posted yet.{" "}
            <Link href={`${STOCK_HREF}?action=new`} className="font-medium text-primary hover:underline">
              Post your first adjustment
            </Link>
            .
          </div>
        ) : (
          <div className="surface-inset overflow-auto rounded-lg">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
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
                {snapshot.recentAdjustments.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-b-0">
                    <td className="p-2.5">
                      <Link
                        href={`${STOCK_HREF}?id=${encodeURIComponent(row.id)}`}
                        className="font-mono text-xs font-medium text-primary hover:underline"
                      >
                        {row.adjustment_number}
                      </Link>
                    </td>
                    <td className="p-2.5">
                      <div className="font-medium">{row.location_name}</div>
                      {row.location_code ? (
                        <div className="text-xs text-muted-foreground">{row.location_code}</div>
                      ) : null}
                    </td>
                    <td className="p-2.5">{stockAdjustmentKindLabel(row.kind)}</td>
                    <td className="p-2.5">
                      <div className="line-clamp-2">{row.reason}</div>
                    </td>
                    <td className="p-2.5 text-right tabular-nums">{row.line_count}</td>
                    <td className="p-2.5 text-muted-foreground">{formatDate(row.posted_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
