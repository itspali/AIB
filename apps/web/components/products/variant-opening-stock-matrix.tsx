"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import {
  getItemOpeningStockOnHand,
  getVariantAssortment,
  postItemOpeningStock,
  type VariantAssortmentCell,
} from "@/app/items/actions";
import type { ReachPersistResult } from "@/components/products/variant-assortment-matrix";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { UserFacingErrorMessage } from "@/components/ui/user-facing-error-message";
import type { UserFacingErrorAction } from "@/lib/errors/user-facing-error";
import {
  VISIBILITY_OPENING_STOCK_EMPTY_ASSORTMENT,
} from "@/lib/products/product-user-labels";
import {
  hasPendingOpeningStockEntries,
  isOpeningStockCellLocked,
  isOpeningStockEligibleVariant,
  openingStockCellKey,
  resolveOpeningUnitCost,
  type OpeningStockDraftCell,
} from "@/lib/products/opening-stock";
import type { ProductVariantSnapshot } from "@/lib/products/types";
import { cn } from "@/lib/utils";

/** Match Locations assortment sub-column widths. */
const OPENING_QTY_COL_CLASS = "w-14 min-w-14 shrink-0";
const OPENING_COST_COL_CLASS = "w-16 min-w-16 shrink-0";

function OpeningSubcolumnHeader({
  label,
  widthClass,
  showLeftBorder,
}: {
  label: string;
  widthClass: string;
  showLeftBorder: boolean;
}) {
  return (
    <th
      className={cn(
        widthClass,
        "px-1 py-1 text-center align-bottom",
        showLeftBorder && "border-l border-border/60"
      )}
    >
      <div className="flex min-h-11 flex-col items-center justify-end gap-1">
        <span
          className="max-w-full truncate px-0.5 text-[10px] font-medium leading-none text-muted-foreground"
          title={label}
        >
          {label}
        </span>
        <span className="h-4 w-4 shrink-0" aria-hidden />
      </div>
    </th>
  );
}

export type VariantOpeningStockMatrixHandle = {
  persist: () => Promise<ReachPersistResult>;
};

type Props = {
  itemId: string;
  variants: ProductVariantSnapshot[];
  purchasePrice?: string;
  standardCost?: string;
  /** Live rows from Locations matrix (includes unsaved Stock toggles). */
  stockedCellsOverride?: VariantAssortmentCell[];
  readOnly?: boolean;
  embedded?: boolean;
  persistError?: string;
  persistErrorAction?: UserFacingErrorAction;
};

type LocationMeta = {
  id: string;
  name: string;
  is_stock_holding: boolean;
  presence_type: string;
};

type DraftMap = Record<string, Pick<OpeningStockDraftCell, "quantity" | "unit_cost">>;

export const VariantOpeningStockMatrix = forwardRef<VariantOpeningStockMatrixHandle, Props>(
  function VariantOpeningStockMatrix(
    {
      itemId,
      variants,
      purchasePrice = "",
      standardCost = "",
      stockedCellsOverride,
      readOnly = false,
      embedded = false,
      persistError,
      persistErrorAction,
    },
    ref
  ) {
    const [loading, setLoading] = useState(true);
    const [locations, setLocations] = useState<LocationMeta[]>([]);
    const [stockedCells, setStockedCells] = useState<VariantAssortmentCell[]>([]);
    const [onHandByKey, setOnHandByKey] = useState<
      Record<string, { quantity_on_hand: string; average_cost: string }>
    >({});
    const [draft, setDraft] = useState<DraftMap>({});

    const activeVariants = useMemo(
      () => variants.filter((variant) => isOpeningStockEligibleVariant(variant)),
      [variants]
    );

    const effectiveStockedCells = stockedCellsOverride ?? stockedCells;

    const stockedLocations = useMemo(
      () =>
        locations.filter(
          (location) =>
            location.is_stock_holding && location.presence_type !== "VIRTUAL"
        ),
      [locations]
    );

    const visibleColumns = useMemo(() => {
      const locationIds = new Set<string>();
      for (const cell of effectiveStockedCells) {
        if (!cell.is_stocked) continue;
        locationIds.add(cell.location_id);
      }
      return stockedLocations.filter((location) => locationIds.has(location.id));
    }, [effectiveStockedCells, stockedLocations]);

    const load = useCallback(async () => {
      setLoading(true);
      const [assortmentResult, onHandResult] = await Promise.all([
        getVariantAssortment(itemId),
        getItemOpeningStockOnHand(itemId),
      ]);
      if ("data" in assortmentResult) {
        setLocations(assortmentResult.data.locations);
        setStockedCells(assortmentResult.data.cells);
      }
      if ("cells" in onHandResult) {
        const next: Record<string, { quantity_on_hand: string; average_cost: string }> = {};
        for (const cell of onHandResult.cells) {
          next[openingStockCellKey(cell.variant_id, cell.location_id)] = {
            quantity_on_hand: cell.quantity_on_hand,
            average_cost: cell.average_cost,
          };
        }
        setOnHandByKey(next);
      }
      setLoading(false);
    }, [itemId]);

    useEffect(() => {
      void load();
    }, [load]);

    const resolveUnitCost = useCallback(
      (variant: ProductVariantSnapshot, averageCost: string) =>
        resolveOpeningUnitCost({
          variantPurchasePrice: variant.purchase_price,
          itemPurchasePrice: purchasePrice,
          standardCost,
          averageCost,
        }),
      [purchasePrice, standardCost]
    );

    const isStockedCell = useCallback(
      (variantId: string, locationId: string) => {
        return effectiveStockedCells.some(
          (cell) =>
            cell.variant_id === variantId &&
            cell.location_id === locationId &&
            cell.is_stocked
        );
      },
      [effectiveStockedCells]
    );

    const patchDraft = useCallback(
      (
        variantId: string,
        locationId: string,
        patch: Partial<Pick<OpeningStockDraftCell, "quantity" | "unit_cost">>
      ) => {
        const key = openingStockCellKey(variantId, locationId);
        setDraft((current) => ({
          ...current,
          [key]: {
            quantity: patch.quantity ?? current[key]?.quantity ?? "",
            unit_cost: patch.unit_cost ?? current[key]?.unit_cost ?? "",
          },
        }));
      },
      []
    );

    const buildDraftEntries = useCallback((): OpeningStockDraftCell[] => {
      const entries: OpeningStockDraftCell[] = [];
      for (const variant of activeVariants) {
        for (const location of visibleColumns) {
          if (!isStockedCell(variant.id, location.id)) continue;
          const key = openingStockCellKey(variant.id, location.id);
          const onHand = onHandByKey[key];
          if (isOpeningStockCellLocked(onHand?.quantity_on_hand)) continue;
          const quantity = draft[key]?.quantity ?? "";
          const unit_cost =
            draft[key]?.unit_cost ??
            resolveUnitCost(variant, onHand?.average_cost ?? "");
          if (!quantity.trim() && !unit_cost.trim()) continue;
          entries.push({
            variant_id: variant.id,
            location_id: location.id,
            quantity,
            unit_cost,
          });
        }
      }
      return entries;
    }, [activeVariants, draft, isStockedCell, onHandByKey, resolveUnitCost, visibleColumns]);

    const persist = useCallback(async (): Promise<ReachPersistResult> => {
      const entries = buildDraftEntries();
      if (!hasPendingOpeningStockEntries(entries)) {
        return { ok: true };
      }

      const result = await postItemOpeningStock(itemId, entries);
      if ("error" in result) {
        return {
          ok: false,
          failures: {
            opening: result.error,
            openingAction: result.errorAction,
          },
        };
      }

      setDraft({});
      await load();
      return { ok: true };
    }, [buildDraftEntries, itemId, load]);

    useImperativeHandle(ref, () => ({ persist }), [persist]);

    const shellClass = embedded
      ? "w-full space-y-2"
      : "surface-panel w-full space-y-4";

    if (loading) {
      return (
        <section className={shellClass}>
          <p className="text-sm text-muted-foreground">Loading opening stock…</p>
        </section>
      );
    }

    if (visibleColumns.length === 0 || activeVariants.length === 0) {
      return (
        <section className={shellClass}>
          <p className="text-sm text-muted-foreground">
            {VISIBILITY_OPENING_STOCK_EMPTY_ASSORTMENT}
          </p>
        </section>
      );
    }

    return (
      <section className={shellClass}>
        {persistError ? (
          <UserFacingErrorMessage message={persistError} action={persistErrorAction} />
        ) : null}
        <div
          className={cn(
            "max-w-full overflow-x-auto",
            embedded ? "rounded-md border border-border/60" : "surface-inset"
          )}
        >
          <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th
                  rowSpan={2}
                  className="min-w-[7rem] bg-muted/40 px-2 py-1.5 align-middle text-xs font-medium text-muted-foreground"
                >
                  Variant
                </th>
                {visibleColumns.map((location) => (
                  <th
                    key={location.id}
                    colSpan={2}
                    className="border-l border-border/60 px-2 py-1.5 text-center text-xs font-medium text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span>{location.name}</span>
                      <Badge variant="locked">Storage</Badge>
                    </div>
                  </th>
                ))}
              </tr>
              <tr className="border-b border-border bg-muted/30 text-left">
                {visibleColumns.flatMap((location) => [
                  <OpeningSubcolumnHeader
                    key={`${location.id}-qty`}
                    label="Qty"
                    widthClass={OPENING_QTY_COL_CLASS}
                    showLeftBorder
                  />,
                  <OpeningSubcolumnHeader
                    key={`${location.id}-cost`}
                    label="Cost"
                    widthClass={OPENING_COST_COL_CLASS}
                    showLeftBorder={false}
                  />,
                ])}
              </tr>
            </thead>
            <tbody>
              {activeVariants.map((variant) => (
                <tr key={variant.id} className="border-b border-border last:border-0">
                  <td className="min-w-[7rem] bg-background px-2 py-1.5">
                    <span className="break-all font-mono text-xs leading-snug">{variant.sku}</span>
                  </td>
                  {visibleColumns.flatMap((location) => {
                    const key = openingStockCellKey(variant.id, location.id);
                    const stocked = isStockedCell(variant.id, location.id);

                    if (!stocked) {
                      return [
                        <td
                          key={`${location.id}-qty`}
                          className={cn(
                            OPENING_QTY_COL_CLASS,
                            "border-l border-border/40 px-1 py-1.5 text-center text-xs text-muted-foreground"
                          )}
                        >
                          —
                        </td>,
                        <td
                          key={`${location.id}-cost`}
                          className={cn(
                            OPENING_COST_COL_CLASS,
                            "px-1 py-1.5 text-center text-xs text-muted-foreground"
                          )}
                        >
                          —
                        </td>,
                      ];
                    }

                    const onHand = onHandByKey[key];
                    const locked = isOpeningStockCellLocked(onHand?.quantity_on_hand);
                    const quantity = locked
                      ? onHand?.quantity_on_hand ?? "0"
                      : draft[key]?.quantity ?? "";
                    const unitCost = locked
                      ? onHand?.average_cost ?? "0"
                      : draft[key]?.unit_cost ??
                        resolveUnitCost(variant, onHand?.average_cost ?? "");

                    const qtyCell = locked ? (
                      <span className="block text-center font-mono text-sm tabular-nums">
                        {quantity}
                      </span>
                    ) : (
                      <Input
                        className="h-8 w-full min-w-0 max-w-full px-1.5 text-center text-sm tabular-nums"
                        value={quantity}
                        disabled={readOnly}
                        inputMode="decimal"
                        placeholder=""
                        aria-label={`Opening quantity for ${variant.sku} at ${location.name}`}
                        onChange={(event) =>
                          patchDraft(variant.id, location.id, {
                            quantity: event.target.value,
                          })
                        }
                      />
                    );

                    const costCell = locked ? (
                      <span className="block text-right font-mono text-sm tabular-nums text-muted-foreground">
                        {unitCost}
                      </span>
                    ) : (
                      <Input
                        className="h-8 w-full min-w-0 max-w-full px-1.5 text-right text-sm tabular-nums"
                        value={unitCost}
                        disabled={readOnly}
                        inputMode="decimal"
                        placeholder=""
                        aria-label={`Unit cost for ${variant.sku} at ${location.name}`}
                        onChange={(event) =>
                          patchDraft(variant.id, location.id, {
                            unit_cost: event.target.value,
                          })
                        }
                      />
                    );

                    return [
                      <td
                        key={`${location.id}-qty`}
                        className={cn(
                          OPENING_QTY_COL_CLASS,
                          "border-l border-border/40 px-1 py-1.5 align-middle"
                        )}
                      >
                        {qtyCell}
                      </td>,
                      <td
                        key={`${location.id}-cost`}
                        className={cn(OPENING_COST_COL_CLASS, "px-1 py-1.5 align-middle")}
                      >
                        {costCell}
                      </td>,
                    ];
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }
);
