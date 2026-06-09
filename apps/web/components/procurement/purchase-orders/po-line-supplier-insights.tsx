"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { Info, Loader2, Package } from "lucide-react";
import { loadSupplierItemInsights } from "@/app/procurement/purchase-orders/actions";
import type { PoSupplierItemInsights } from "@/lib/procurement/purchase-orders/supplier-item-insights";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { popoverAboveDrawerClassName } from "@/lib/layout/overlay-z-index";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";
import {
  compareLinePriceToCatalog,
} from "@/lib/procurement/purchase-orders/supplier-item-insights";
import { formatPoMoney } from "@/lib/procurement/purchase-orders/totals";
import { cn } from "@/lib/utils";

type Props = {
  line: PoDraftLine;
  supplierId: string;
  destinationLocationId: string;
  excludePurchaseOrderId?: string | null;
  disabled?: boolean;
  onApplyCatalogPrice?: (lineKey: string, price: string) => void;
};

function InsightRow({
  label,
  value,
  hint,
  valueClassName,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <div className="min-w-0 text-right">
        <div className={cn("font-medium tabular-nums text-foreground", valueClassName)}>{value}</div>
        {hint ? <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div> : null}
      </div>
    </div>
  );
}

function formatOrderedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function InsightsPanel({
  insights,
  line,
  onApplyCatalogPrice,
}: {
  insights: PoSupplierItemInsights;
  line: PoDraftLine;
  onApplyCatalogPrice?: (lineKey: string, price: string) => void;
}) {
  const priceCompare = compareLinePriceToCatalog(
    line.unit_price_contractual,
    insights.catalog.supplier_price
  );
  const lineQty = Number(line.quantity_ordered);
  const moq = insights.catalog.minimum_order_quantity
    ? Number(insights.catalog.minimum_order_quantity)
    : null;
  const belowMoq =
    moq != null && Number.isFinite(moq) && Number.isFinite(lineQty) && lineQty > 0 && lineQty < moq;

  return (
    <div className="max-h-[min(24rem,70vh)] overflow-y-auto p-3">
      <div className="flex items-start gap-2.5">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded border border-border/60 bg-muted">
          {insights.image_url ? (
            <img
              src={insights.image_url}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <Package className="h-4 w-4 text-muted-foreground" aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{insights.item_name}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">{insights.variant_sku}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {insights.supplier_name}
            {insights.catalog.supplier_part_number
              ? ` · ${insights.catalog.supplier_part_number}`
              : ""}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2 border-t border-border pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Pricing
        </p>
        <InsightRow
          label="Catalog price"
          value={
            insights.catalog.supplier_price
              ? formatPoMoney(Number(insights.catalog.supplier_price))
              : "—"
          }
          hint={
            insights.catalog.is_preferred ? (
              <Badge variant="default" className="text-[10px]">
                Preferred
              </Badge>
            ) : !insights.catalog.has_catalog_entry ? (
              "No catalog entry for this supplier"
            ) : undefined
          }
        />
        <InsightRow
          label="Line price"
          value={formatPoMoney(Number(line.unit_price_contractual || 0))}
          hint={priceCompare.label}
          valueClassName={
            priceCompare.delta != null && priceCompare.delta > 0
              ? "text-amber-700 dark:text-amber-300"
              : undefined
          }
        />
        {insights.standard_cost ? (
          <InsightRow
            label="Standard cost"
            value={formatPoMoney(Number(insights.standard_cost))}
          />
        ) : null}
        {insights.last_purchase ? (
          <InsightRow
            label="Last paid"
            value={formatPoMoney(Number(insights.last_purchase.unit_price))}
            hint={`${insights.last_purchase.voucher_number} · ${formatOrderedDate(insights.last_purchase.ordered_at)}`}
          />
        ) : null}
      </div>

      <div className="mt-3 space-y-2 border-t border-border pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Supply
        </p>
        {insights.catalog.minimum_order_quantity ? (
          <InsightRow
            label="MOQ"
            value={insights.catalog.minimum_order_quantity}
            hint={belowMoq ? "Line qty is below MOQ" : undefined}
            valueClassName={belowMoq ? "text-amber-700 dark:text-amber-300" : undefined}
          />
        ) : null}
        {insights.catalog.lead_time_days != null ? (
          <InsightRow label="Lead time" value={`${insights.catalog.lead_time_days} days`} />
        ) : null}
        <InsightRow label="UoM" value={insights.unit_of_measure} />
      </div>

      {insights.stock ? (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Stock @ {insights.stock.location_name || "destination"}
          </p>
          <InsightRow label="On hand" value={insights.stock.quantity_on_hand} />
          {insights.stock.reorder_point ? (
            <InsightRow
              label="Reorder point"
              value={insights.stock.reorder_point}
              hint={insights.stock.below_reorder ? "Below reorder" : undefined}
              valueClassName={
                insights.stock.below_reorder ? "text-amber-700 dark:text-amber-300" : undefined
              }
            />
          ) : null}
          <InsightRow
            label="Avg cost"
            value={formatPoMoney(Number(insights.stock.average_cost || 0))}
          />
        </div>
      ) : null}

      {Number(insights.open_purchase.open_quantity) > 0 ? (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Open orders
          </p>
          <InsightRow
            label="On open POs"
            value={insights.open_purchase.open_quantity}
            hint={
              insights.open_purchase.order_count === 1
                ? "1 order"
                : `${insights.open_purchase.order_count} orders`
            }
          />
        </div>
      ) : null}

      {insights.alternative_suppliers.length > 0 ? (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Other suppliers
          </p>
          {insights.alternative_suppliers.map((row) => (
            <InsightRow
              key={row.supplier_id}
              label={row.supplier_name}
              value={formatPoMoney(Number(row.supplier_price))}
              hint={row.is_preferred ? "Preferred" : undefined}
            />
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
        {insights.catalog.supplier_price &&
        onApplyCatalogPrice &&
        line.unit_price_contractual !== insights.catalog.supplier_price ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onApplyCatalogPrice(line.key, insights.catalog.supplier_price!)}
          >
            Use catalog price
          </Button>
        ) : null}
        {insights.last_purchase ? (
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" asChild>
            <Link href={`/procurement/purchase-orders?id=${insights.last_purchase.purchase_order_id}`}>
              View last PO
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function PoLineSupplierInsightsButton({
  line,
  supplierId,
  destinationLocationId,
  excludePurchaseOrderId,
  disabled = false,
  onApplyCatalogPrice,
}: Props) {
  const [open, setOpen] = useState(false);
  const [insights, setInsights] = useState<PoSupplierItemInsights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadInsights = useCallback(() => {
    if (!line.variant_id || !supplierId || !destinationLocationId) return;

    startTransition(async () => {
      setError(null);
      const result = await loadSupplierItemInsights({
        supplier_id: supplierId,
        variant_id: line.variant_id,
        destination_location_id: destinationLocationId,
        exclude_purchase_order_id: excludePurchaseOrderId,
        line_unit_price: line.unit_price_contractual,
      });
      if ("error" in result) {
        setInsights(null);
        setError(result.error);
        return;
      }
      setInsights(result.insights);
    });
  }, [
    destinationLocationId,
    excludePurchaseOrderId,
    line.unit_price_contractual,
    line.variant_id,
    supplierId,
  ]);

  if (!line.variant_id || !supplierId || !destinationLocationId) {
    return null;
  }

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          loadInsights();
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 w-9 shrink-0 p-0 text-muted-foreground"
          disabled={disabled}
          aria-label="Supplier and item insights"
          title="Supplier and item insights"
        >
          {isPending && open ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Info className="h-4 w-4" aria-hidden />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={4}
        className={cn("w-80 p-0", popoverAboveDrawerClassName)}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        {isPending && !insights ? (
          <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading insights…
          </div>
        ) : error ? (
          <p className="p-4 text-sm text-destructive">{error}</p>
        ) : insights ? (
          <InsightsPanel
            insights={insights}
            line={line}
            onApplyCatalogPrice={onApplyCatalogPrice}
          />
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
