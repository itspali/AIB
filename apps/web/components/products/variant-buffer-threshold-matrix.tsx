"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  getItemBufferThresholds,
  saveItemBufferThresholds,
  type BufferThresholdData,
} from "@/app/items/actions";
import { useOptionalItemExtensionData } from "@/components/products/item-extension-data-provider";
import {
  useVariantMatrixSelection,
  VariantMatrixSelectCell,
  VariantMatrixSelectHeader,
} from "@/components/products/variant-matrix-selection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  buildBufferThresholdSaveRows,
  bufferCellKey,
  formatBufferQuantity,
  resolveBufferReorderDisplay,
} from "@/lib/products/buffer-thresholds";
import { BUFFER_THRESHOLDS_MATRIX_HELP } from "@/lib/products/product-user-labels";
import type { ProductVariantSnapshot } from "@/lib/products/types";
import { cn } from "@/lib/utils";

type Props = {
  itemId: string;
  variants: ProductVariantSnapshot[];
  defaultReorderPoint: string;
  readOnly?: boolean;
  embedded?: boolean;
};

type LocationMeta = BufferThresholdData["locations"][number];

function locationSupportsStock(location: LocationMeta): boolean {
  return location.is_stock_holding && location.presence_type !== "VIRTUAL";
}

function applyBufferData(
  data: BufferThresholdData,
  setLocations: (locations: LocationMeta[]) => void,
  setCells: (cells: Record<string, string>) => void,
  setOverrides: (overrides: Record<string, boolean>) => void
) {
  setLocations(data.locations);
  const nextCells: Record<string, string> = {};
  const nextOverrides: Record<string, boolean> = {};
  for (const cell of data.cells) {
    const key = bufferCellKey(cell.variant_id, cell.location_id);
    nextCells[key] = formatBufferQuantity(cell.reorder_point_qty);
    nextOverrides[key] = true;
  }
  setCells(nextCells);
  setOverrides(nextOverrides);
}

export function VariantBufferThresholdMatrix({
  itemId,
  variants,
  defaultReorderPoint,
  readOnly = false,
  embedded = false,
}: Props) {
  const router = useRouter();
  const extension = useOptionalItemExtensionData();
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<LocationMeta[]>([]);
  const [cells, setCells] = useState<Record<string, string>>({});
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();

  const activeVariants = useMemo(
    () => variants.filter((variant) => variant.is_active),
    [variants]
  );
  const activeVariantIds = useMemo(
    () => activeVariants.map((variant) => variant.id),
    [activeVariants]
  );
  const stockLocations = useMemo(
    () => locations.filter((location) => locationSupportsStock(location)),
    [locations]
  );
  const stockLocationIds = useMemo(
    () => stockLocations.map((location) => location.id),
    [stockLocations]
  );

  const selection = useVariantMatrixSelection(activeVariantIds);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getItemBufferThresholds(itemId);
    if ("error" in result) {
      toast.error(result.error ?? "Unable to load reorder thresholds.");
      setLoading(false);
      return;
    }
    applyBufferData(result.data, setLocations, setCells, setOverrides);
    setLoading(false);
  }, [itemId]);

  useEffect(() => {
    if (extension?.status === "ready") {
      applyBufferData(
        extension.data.bufferThresholds,
        setLocations,
        setCells,
        setOverrides
      );
      setLoading(false);
      return;
    }
    if (extension?.status === "loading") {
      setLoading(true);
      return;
    }
    void load();
  }, [extension?.status, extension?.data, load]);

  const setCell = (variantId: string, locationId: string, value: string) => {
    const key = bufferCellKey(variantId, locationId);
    setCells((prev) => ({ ...prev, [key]: value }));
    setOverrides((prev) => ({
      ...prev,
      [key]: value.trim() !== "" ? true : prev[key] ?? false,
    }));
  };

  const fillLocationColumn = (locationId: string, value: string, variantIds: string[]) => {
    setCells((prev) => {
      const next = { ...prev };
      for (const variantId of variantIds) {
        next[bufferCellKey(variantId, locationId)] = value;
      }
      return next;
    });
    setOverrides((prev) => {
      const next = { ...prev };
      for (const variantId of variantIds) {
        const key = bufferCellKey(variantId, locationId);
        next[key] = value.trim() !== "" ? true : next[key] ?? false;
      }
      return next;
    });
  };

  const handleSave = () => {
    const rows = buildBufferThresholdSaveRows(
      activeVariantIds,
      stockLocationIds,
      cells,
      overrides
    );
    if (rows.length === 0) {
      toast.message("No reorder changes to save.");
      return;
    }

    startTransition(async () => {
      const result = await saveItemBufferThresholds(itemId, rows);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to save reorder thresholds.");
        return;
      }
      toast.success("Reorder thresholds saved.");
      router.refresh();
      void load();
    });
  };

  const bulkVariantIds = selection.someSelected ? selection.selectedList : activeVariantIds;
  const shellClass = embedded ? "space-y-2" : "surface-panel space-y-4";

  if (loading) {
    return (
      <section className={shellClass}>
        <p className="text-sm text-muted-foreground">Loading reorder thresholds…</p>
      </section>
    );
  }

  if (stockLocations.length === 0) {
    return (
      <section className={shellClass}>
        <p className="text-sm text-muted-foreground">
          No stock-holding locations yet. Configure locations under Settings to set per-location
          reorder points.
        </p>
      </section>
    );
  }

  if (activeVariants.length === 0) {
    return (
      <section className={shellClass}>
        <p className="text-sm text-muted-foreground">
          Add at least one active variant to configure reorder thresholds.
        </p>
      </section>
    );
  }

  return (
    <section className={shellClass}>
      <p className="text-xs text-muted-foreground">{BUFFER_THRESHOLDS_MATRIX_HELP}</p>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {selection.someSelected ? (
          <span className="mr-auto text-xs text-muted-foreground">
            {selection.selectedList.length} variant
            {selection.selectedList.length === 1 ? "" : "s"} selected
          </span>
        ) : null}
        {!readOnly ? (
          <Button type="button" size="sm" variant="outline" onClick={handleSave} disabled={isPending}>
            Save reorder thresholds
          </Button>
        ) : null}
      </div>

      <div
        className={
          embedded ? "overflow-x-auto rounded-md border border-border/60" : "surface-inset overflow-x-auto"
        }
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="sticky left-0 z-10 w-10 bg-muted/40 px-2 py-1.5">
                {!readOnly ? (
                  <VariantMatrixSelectHeader
                    checked={selection.allSelected}
                    indeterminate={selection.someSelected && !selection.allSelected}
                    disabled={isPending || activeVariants.length === 0}
                    onCheckedChange={selection.toggleAll}
                  />
                ) : null}
              </th>
              <th className="sticky left-10 z-10 min-w-[7rem] bg-muted/40 px-2 py-1.5 text-xs font-medium text-muted-foreground">
                Variant
              </th>
              {stockLocations.map((location) => (
                <th
                  key={location.id}
                  className="min-w-[7.5rem] border-l border-border/60 px-2 py-1.5 text-center text-xs font-medium text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-1">
                    <span>{location.name}</span>
                    <Badge variant="locked">Reorder</Badge>
                    {!readOnly ? (
                      <Input
                        className="h-7 w-[5.5rem] text-center font-mono text-xs"
                        inputMode="decimal"
                        placeholder="All"
                        disabled={isPending}
                        aria-label={`Fill reorder for ${location.name}`}
                        onBlur={(event) => {
                          const value = event.currentTarget.value.trim();
                          if (!value) return;
                          fillLocationColumn(location.id, value, bulkVariantIds);
                          event.currentTarget.value = "";
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") return;
                          event.preventDefault();
                          const value = event.currentTarget.value.trim();
                          if (!value) return;
                          fillLocationColumn(location.id, value, bulkVariantIds);
                          event.currentTarget.value = "";
                        }}
                      />
                    ) : null}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeVariants.map((variant) => (
              <tr key={variant.id} className="border-b border-border last:border-0">
                <td className="sticky left-0 z-10 bg-background px-2 py-1.5">
                  {!readOnly ? (
                    <VariantMatrixSelectCell
                      checked={selection.selectedIds.has(variant.id)}
                      disabled={isPending}
                      label={`Select ${variant.sku}`}
                      onCheckedChange={(checked) => selection.toggleOne(variant.id, checked)}
                    />
                  ) : null}
                </td>
                <td className="sticky left-10 z-10 min-w-[7rem] bg-background px-2 py-1.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="break-all font-mono text-xs leading-snug">{variant.sku}</span>
                    {variant.is_master ? <Badge variant="active">Master</Badge> : null}
                  </div>
                </td>
                {stockLocations.map((location) => {
                  const key = bufferCellKey(variant.id, location.id);
                  const display = resolveBufferReorderDisplay(cells[key], defaultReorderPoint);
                  return (
                    <td key={location.id} className="border-l border-border/60 px-2 py-1.5">
                      <Input
                        className={cn(
                          "h-8 text-right font-mono text-xs",
                          display.inherited && "text-muted-foreground"
                        )}
                        inputMode="decimal"
                        value={display.value}
                        placeholder={display.placeholder}
                        disabled={readOnly || isPending}
                        aria-label={`Reorder for ${variant.sku} at ${location.name}`}
                        onChange={(event) => setCell(variant.id, location.id, event.target.value)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
