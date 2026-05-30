"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  getVariantAssortment,
  saveVariantAssortment,
  type VariantAssortmentCell,
} from "@/app/items/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { ProductVariantSnapshot } from "@/lib/products/types";

type Props = {
  itemId: string;
  variants: ProductVariantSnapshot[];
  readOnly?: boolean;
};

type LocationMeta = {
  id: string;
  name: string;
  presence_type: string;
  is_stock_holding: boolean;
};

type CellState = { is_stocked: boolean; is_sellable: boolean };

function cellKey(variantId: string, locationId: string): string {
  return `${variantId}:${locationId}`;
}

function locationSupportsStock(location: LocationMeta): boolean {
  return location.is_stock_holding && location.presence_type !== "VIRTUAL";
}

export function VariantAssortmentMatrix({ itemId, variants, readOnly = false }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<LocationMeta[]>([]);
  const [cells, setCells] = useState<Record<string, CellState>>({});
  const [isPending, startTransition] = useTransition();

  const activeVariants = useMemo(() => variants.filter((v) => v.is_active), [variants]);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getVariantAssortment(itemId);
    if ("error" in result) {
      toast.error(result.error ?? "Unable to load assortment.");
      setLoading(false);
      return;
    }
    setLocations(result.data.locations);
    const map: Record<string, CellState> = {};
    for (const cell of result.data.cells) {
      map[cellKey(cell.variant_id, cell.location_id)] = {
        is_stocked: cell.is_stocked,
        is_sellable: cell.is_sellable,
      };
    }
    setCells(map);
    setLoading(false);
  }, [itemId]);

  useEffect(() => {
    void load();
  }, [load]);

  const setCell = (variantId: string, locationId: string, patch: Partial<CellState>) => {
    setCells((prev) => {
      const key = cellKey(variantId, locationId);
      const current = prev[key] ?? { is_stocked: false, is_sellable: false };
      return { ...prev, [key]: { ...current, ...patch } };
    });
  };

  const handleSave = () => {
    const rows: VariantAssortmentCell[] = [];
    for (const variant of activeVariants) {
      for (const location of locations) {
        const state = cells[cellKey(variant.id, location.id)];
        if (!state) continue;
        if (!state.is_stocked && !state.is_sellable) continue;
        rows.push({
          variant_id: variant.id,
          location_id: location.id,
          is_stocked: state.is_stocked && locationSupportsStock(location),
          is_sellable: state.is_sellable,
          is_orderable: state.is_sellable,
        });
      }
    }

    startTransition(async () => {
      const result = await saveVariantAssortment(itemId, rows);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to save assortment.");
        return;
      }
      toast.success("Assortment saved.");
      router.refresh();
      void load();
    });
  };

  if (loading) {
    return (
      <section className="surface-panel">
        <p className="text-sm text-muted-foreground">Loading assortment…</p>
      </section>
    );
  }

  if (locations.length === 0) {
    return (
      <section className="surface-panel space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Variant Assortment
        </h3>
        <p className="text-sm text-muted-foreground">
          No active locations yet. Create locations to plan which variants are carried where.
        </p>
      </section>
    );
  }

  return (
    <section className="surface-panel space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Variant Assortment
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Plan which variants are stocked (S) and sellable (Sell) at each location. Stocking is
            disabled for virtual / non-stock-holding locations.
          </p>
        </div>
        {!readOnly && (
          <Button type="button" size="sm" onClick={handleSave} disabled={isPending}>
            Save assortment
          </Button>
        )}
      </div>

      <div className="surface-inset overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="sticky left-0 z-10 bg-muted/40 p-3 font-medium text-muted-foreground">
                Variant
              </th>
              {locations.map((location) => (
                <th key={location.id} className="p-3 text-center font-medium text-muted-foreground">
                  <div className="flex flex-col items-center gap-1">
                    <span>{location.name}</span>
                    {!locationSupportsStock(location) && (
                      <Badge variant="locked">{location.presence_type}</Badge>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeVariants.map((variant) => (
              <tr key={variant.id} className="border-b border-border last:border-0">
                <td className="sticky left-0 z-10 bg-background p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{variant.sku}</span>
                    {variant.is_master && <Badge variant="active">Master</Badge>}
                  </div>
                </td>
                {locations.map((location) => {
                  const state = cells[cellKey(variant.id, location.id)] ?? {
                    is_stocked: false,
                    is_sellable: false,
                  };
                  const canStock = locationSupportsStock(location);
                  return (
                    <td key={location.id} className="p-3">
                      <div className="flex items-center justify-center gap-3">
                        <label className="flex items-center gap-1 text-xs">
                          <Checkbox
                            checked={state.is_stocked && canStock}
                            disabled={readOnly || isPending || !canStock}
                            onCheckedChange={(checked) =>
                              setCell(variant.id, location.id, { is_stocked: Boolean(checked) })
                            }
                          />
                          S
                        </label>
                        <label className="flex items-center gap-1 text-xs">
                          <Checkbox
                            checked={state.is_sellable}
                            disabled={readOnly || isPending}
                            onCheckedChange={(checked) =>
                              setCell(variant.id, location.id, { is_sellable: Boolean(checked) })
                            }
                          />
                          Sell
                        </label>
                      </div>
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
