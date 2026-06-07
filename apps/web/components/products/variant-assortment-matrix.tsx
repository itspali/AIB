"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  getVariantAssortment,
  getVariantChannelAvailability,
  saveVariantAssortment,
  saveVariantChannelAvailability,
  type VariantAssortmentCell,
  type VariantAssortmentData,
  type VariantChannelCell,
} from "@/app/items/actions";
import { useOptionalItemExtensionData } from "@/components/products/item-extension-data-provider";
import {
  useVariantMatrixSelection,
  VariantMatrixSelectCell,
  VariantMatrixSelectHeader,
} from "@/components/products/variant-matrix-selection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  VISIBILITY_MATRIX_SELL_LABEL,
  VISIBILITY_MATRIX_STOCK_LABEL,
} from "@/lib/products/product-user-labels";
import type { ProductMasterFormValues, ProductVariantSnapshot } from "@/lib/products/types";
import { cn } from "@/lib/utils";

type Props = {
  itemId: string;
  variants: ProductVariantSnapshot[];
  /** When channels are listed, show sellable variant rows only. */
  sellableVariantsOnly?: boolean;
  storefrontVisibility?: ProductMasterFormValues["storefront_visibility"];
  readOnly?: boolean;
  embedded?: boolean;
};

type ChannelMeta = {
  id: string;
  name: string;
  channel_type: string;
};

type LocationMeta = {
  id: string;
  name: string;
  presence_type: string;
  is_stock_holding: boolean;
  is_commercial_storefront: boolean;
};

type LocationColumnKind = "stock" | "sell";

type CellState = { is_stocked: boolean; is_sellable: boolean };

function cellKey(variantId: string, locationId: string): string {
  return `${variantId}:${locationId}`;
}

function channelCellKey(variantId: string, channelId: string): string {
  return `${variantId}:${channelId}`;
}

function locationSupportsStock(location: LocationMeta): boolean {
  return location.is_stock_holding && location.presence_type !== "VIRTUAL";
}

function locationSupportsSell(location: LocationMeta): boolean {
  return location.is_commercial_storefront;
}

function locationColumns(location: LocationMeta): LocationColumnKind[] {
  const columns: LocationColumnKind[] = [];
  if (locationSupportsStock(location)) columns.push("stock");
  if (locationSupportsSell(location)) columns.push("sell");
  return columns;
}

function applyAssortmentData(
  data: VariantAssortmentData,
  setLocations: (locations: LocationMeta[]) => void,
  setCells: (cells: Record<string, CellState>) => void
) {
  setLocations(data.locations);
  const map: Record<string, CellState> = {};
  for (const cell of data.cells) {
    map[cellKey(cell.variant_id, cell.location_id)] = {
      is_stocked: cell.is_stocked,
      is_sellable: cell.is_sellable,
    };
  }
  setCells(map);
}

export function VariantAssortmentMatrix({
  itemId,
  variants,
  sellableVariantsOnly = false,
  storefrontVisibility = [],
  readOnly = false,
  embedded = false,
}: Props) {
  const router = useRouter();
  const extension = useOptionalItemExtensionData();
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<LocationMeta[]>([]);
  const [cells, setCells] = useState<Record<string, CellState>>({});
  const [channels, setChannels] = useState<ChannelMeta[]>([]);
  const [channelCells, setChannelCells] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();

  const activeVariants = useMemo(() => {
    const active = variants.filter((variant) => variant.is_active);
    if (!sellableVariantsOnly) return active;
    const sellable = active.filter((variant) => variant.is_sellable !== false);
    return sellable.length > 0 ? sellable : active;
  }, [sellableVariantsOnly, variants]);

  const activeVariantIds = useMemo(
    () => activeVariants.map((variant) => variant.id),
    [activeVariants]
  );
  const selection = useVariantMatrixSelection(activeVariantIds);

  const visibleLocations = useMemo(
    () => locations.filter((location) => locationColumns(location).length > 0),
    [locations]
  );

  const listedChannelIds = useMemo(
    () =>
      new Set(
        storefrontVisibility.filter((row) => row.is_visible).map((row) => row.storefront_id)
      ),
    [storefrontVisibility]
  );

  const listedChannels = useMemo(() => {
    return channels
      .filter((channel) => listedChannelIds.has(channel.id))
      .map((channel) => {
        const visibility = storefrontVisibility.find(
          (row) => row.storefront_id === channel.id
        );
        const customName = visibility?.store_custom_name?.trim();
        return {
          ...channel,
          displayName: customName || channel.name,
        };
      });
  }, [channels, listedChannelIds, storefrontVisibility]);

  const showChannelColumns = listedChannels.length > 0;

  const applyChannelData = useCallback(
    (channelList: ChannelMeta[], rows: VariantChannelCell[]) => {
      setChannels(channelList);
      const map: Record<string, boolean> = {};
      for (const cell of rows) {
        map[channelCellKey(cell.variant_id, cell.storefront_id)] = cell.is_visible;
      }
      setChannelCells(map);
    },
    []
  );

  const load = useCallback(async () => {
    setLoading(true);
    const [assortmentResult, channelResult] = await Promise.all([
      getVariantAssortment(itemId),
      getVariantChannelAvailability(itemId),
    ]);
    if ("error" in assortmentResult) {
      toast.error(assortmentResult.error ?? "Unable to load assortment.");
      setLoading(false);
      return;
    }
    if ("error" in channelResult) {
      toast.error(channelResult.error ?? "Unable to load channel availability.");
      setLoading(false);
      return;
    }
    applyAssortmentData(assortmentResult.data, setLocations, setCells);
    applyChannelData(channelResult.data.channels, channelResult.data.cells);
    setLoading(false);
  }, [applyChannelData, itemId]);

  useEffect(() => {
    if (!extension) {
      void load();
      return;
    }
    if (extension.status === "loading" || extension.status === "idle") {
      setLoading(true);
      return;
    }
    if (extension.status === "error") {
      toast.error(extension.error);
      setLoading(false);
      return;
    }
    applyAssortmentData(extension.data.assortment, setLocations, setCells);
    applyChannelData(extension.data.channels.channels, extension.data.channels.cells);
    setLoading(false);
  }, [applyChannelData, extension, load]);

  useEffect(() => {
    setChannelCells((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const variant of activeVariants) {
        for (const channel of channels) {
          if (listedChannelIds.has(channel.id)) continue;
          const key = channelCellKey(variant.id, channel.id);
          if (key in next) {
            delete next[key];
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [activeVariants, channels, listedChannelIds]);

  const setCell = (variantId: string, locationId: string, patch: Partial<CellState>) => {
    setCells((prev) => {
      const key = cellKey(variantId, locationId);
      const current = prev[key] ?? { is_stocked: false, is_sellable: false };
      return { ...prev, [key]: { ...current, ...patch } };
    });
  };

  const toggleLocationColumn = (
    locationId: string,
    field: "is_stocked" | "is_sellable",
    value: boolean,
    variantIds = activeVariantIds
  ) => {
    const location = locations.find((entry) => entry.id === locationId);
    if (!location) return;
    if (field === "is_stocked" && value && !locationSupportsStock(location)) return;
    if (field === "is_sellable" && !locationSupportsSell(location)) return;

    setCells((prev) => {
      const next = { ...prev };
      for (const variantId of variantIds) {
        const key = cellKey(variantId, locationId);
        const current = next[key] ?? { is_stocked: false, is_sellable: false };
        const resolved = { ...current, [field]: value };
        if (field === "is_stocked" && !locationSupportsStock(location)) {
          resolved.is_stocked = false;
        }
        if (field === "is_sellable" && !locationSupportsSell(location)) {
          resolved.is_sellable = false;
        }
        next[key] = resolved;
      }
      return next;
    });
  };

  const setChannelCell = (variantId: string, channelId: string, visible: boolean) => {
    if (!listedChannelIds.has(channelId)) return;
    setChannelCells((prev) => ({
      ...prev,
      [channelCellKey(variantId, channelId)]: visible,
    }));
  };

  const toggleChannelColumn = (
    channelId: string,
    visible: boolean,
    variantIds = activeVariantIds
  ) => {
    if (!listedChannelIds.has(channelId)) return;
    setChannelCells((prev) => {
      const next = { ...prev };
      for (const variantId of variantIds) {
        next[channelCellKey(variantId, channelId)] = visible;
      }
      return next;
    });
  };

  const handleSaveChannels = () => {
    const rows: VariantChannelCell[] = [];
    for (const variant of activeVariants) {
      for (const channel of listedChannels) {
        const visible = channelCells[channelCellKey(variant.id, channel.id)];
        if (visible === undefined) continue;
        rows.push({
          storefront_id: channel.id,
          variant_id: variant.id,
          is_visible: visible,
        });
      }
    }

    startTransition(async () => {
      const result = await saveVariantChannelAvailability(itemId, rows);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to save channel availability.");
        return;
      }
      toast.success("Channel listings saved.");
      router.refresh();
      void load();
    });
  };

  const handleSave = () => {
    const rows: VariantAssortmentCell[] = [];
    for (const variant of activeVariants) {
      for (const location of visibleLocations) {
        const state = cells[cellKey(variant.id, location.id)];
        if (!state) continue;
        const isStocked = state.is_stocked && locationSupportsStock(location);
        const isSellable = state.is_sellable && locationSupportsSell(location);
        if (!isStocked && !isSellable) continue;
        rows.push({
          variant_id: variant.id,
          location_id: location.id,
          is_stocked: isStocked,
          is_sellable: isSellable,
          is_orderable: isSellable,
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

  const bulkVariantIds = selection.someSelected ? selection.selectedList : activeVariantIds;

  const shellClass = embedded ? "space-y-2" : "surface-panel space-y-4";

  if (loading) {
    return (
      <section className={shellClass}>
        <p className="text-sm text-muted-foreground">Loading assortment…</p>
      </section>
    );
  }

  if (visibleLocations.length === 0 && !showChannelColumns) {
    return (
      <section className={shellClass}>
        <p className="text-sm text-muted-foreground">
          No stock-holding or storefront locations yet. Configure locations under Settings to plan
          where variants are carried and sold.
        </p>
      </section>
    );
  }

  return (
    <section className={shellClass}>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {selection.someSelected ? (
          <span className="mr-auto text-xs text-muted-foreground">
            {selection.selectedList.length} variant
            {selection.selectedList.length === 1 ? "" : "s"} selected
          </span>
        ) : null}
        {!readOnly && visibleLocations.length > 0 ? (
          <Button type="button" size="sm" variant="outline" onClick={handleSave} disabled={isPending}>
            Save locations
          </Button>
        ) : null}
        {!readOnly && showChannelColumns ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleSaveChannels}
            disabled={isPending}
          >
            Save channel listings
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
              <th
                rowSpan={2}
                className="sticky left-0 z-10 w-10 bg-muted/40 px-2 py-1.5 align-middle"
              >
                {!readOnly ? (
                  <VariantMatrixSelectHeader
                    checked={selection.allSelected}
                    indeterminate={selection.someSelected && !selection.allSelected}
                    disabled={isPending || activeVariants.length === 0}
                    onCheckedChange={selection.toggleAll}
                  />
                ) : null}
              </th>
              <th
                rowSpan={2}
                className="sticky left-10 z-10 min-w-[7rem] bg-muted/40 px-2 py-1.5 align-middle text-xs font-medium text-muted-foreground"
              >
                Variant
              </th>
              {visibleLocations.map((location) => {
                const columns = locationColumns(location);
                return (
                  <th
                    key={location.id}
                    colSpan={columns.length}
                    className="border-l border-border/60 px-2 py-1.5 text-center text-xs font-medium text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span>{location.name}</span>
                      {!locationSupportsStock(location) && locationSupportsSell(location) ? (
                        <Badge variant="active">Storefront</Badge>
                      ) : null}
                      {locationSupportsStock(location) && !locationSupportsSell(location) ? (
                        <Badge variant="locked">Storage</Badge>
                      ) : null}
                      {!locationSupportsStock(location) && location.presence_type === "VIRTUAL" ? (
                        <Badge variant="locked">{location.presence_type}</Badge>
                      ) : null}
                    </div>
                  </th>
                );
              })}
              {showChannelColumns
                ? listedChannels.map((channel) => (
                    <th
                      key={channel.id}
                      rowSpan={2}
                      className="min-w-[6.5rem] border-l-2 border-primary/20 px-2 py-1.5 text-center text-xs font-medium text-muted-foreground"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className="max-w-[8rem] break-words leading-snug">
                          {channel.displayName}
                        </span>
                        <Badge variant="active">{channel.channel_type}</Badge>
                        {!readOnly ? (
                          <BulkColumnCheckbox
                            disabled={isPending}
                            variantIds={bulkVariantIds}
                            isOn={(variantId) =>
                              channelCells[channelCellKey(variantId, channel.id)] === true
                            }
                            ariaLabel={`Toggle ${channel.displayName} listings`}
                            onCheckedChange={(checked) =>
                              toggleChannelColumn(channel.id, checked, bulkVariantIds)
                            }
                          />
                        ) : null}
                      </div>
                    </th>
                  ))
                : null}
            </tr>
            <tr className="border-b border-border bg-muted/30 text-left">
              {visibleLocations.flatMap((location) => {
                const columns = locationColumns(location);
                return columns.map((kind, index) => (
                  <LocationBulkHeader
                    key={`${location.id}-${kind}`}
                    kind={kind}
                    locationId={location.id}
                    canStock={locationSupportsStock(location)}
                    canSell={locationSupportsSell(location)}
                    readOnly={readOnly}
                    isPending={isPending}
                    showLeftBorder={index === 0}
                    onToggle={toggleLocationColumn}
                    variantIds={bulkVariantIds}
                    cells={cells}
                  />
                ));
              })}
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
                    {variant.is_master && <Badge variant="active">Master</Badge>}
                  </div>
                </td>
                {visibleLocations.flatMap((location) => {
                  const state = cells[cellKey(variant.id, location.id)] ?? {
                    is_stocked: false,
                    is_sellable: false,
                  };
                  const columns = locationColumns(location);
                  return columns.map((kind, index) => (
                    <LocationVariantCell
                      key={`${location.id}-${kind}`}
                      kind={kind}
                      state={state}
                      canStock={locationSupportsStock(location)}
                      canSell={locationSupportsSell(location)}
                      readOnly={readOnly}
                      isPending={isPending}
                      showLeftBorder={index === 0}
                      onStockChange={(checked) =>
                        setCell(variant.id, location.id, { is_stocked: Boolean(checked) })
                      }
                      onSellChange={(checked) =>
                        setCell(variant.id, location.id, { is_sellable: Boolean(checked) })
                      }
                    />
                  ));
                })}
                {showChannelColumns
                  ? listedChannels.map((channel) => {
                      const visible =
                        channelCells[channelCellKey(variant.id, channel.id)] ?? false;
                      return (
                        <td
                          key={channel.id}
                          className="border-l-2 border-primary/20 px-2 py-1.5"
                        >
                          <div className="flex items-center justify-center">
                            <Checkbox
                              checked={visible}
                              disabled={readOnly || isPending}
                              aria-label={`${variant.sku} listed on ${channel.displayName}`}
                              onCheckedChange={(checked) =>
                                setChannelCell(variant.id, channel.id, Boolean(checked))
                              }
                            />
                          </div>
                        </td>
                      );
                    })
                  : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LocationBulkHeader({
  kind,
  locationId,
  canStock,
  canSell,
  readOnly,
  isPending,
  showLeftBorder,
  onToggle,
  variantIds,
  cells,
}: {
  kind: LocationColumnKind;
  locationId: string;
  canStock: boolean;
  canSell: boolean;
  readOnly: boolean;
  isPending: boolean;
  showLeftBorder: boolean;
  onToggle: (
    locationId: string,
    field: "is_stocked" | "is_sellable",
    value: boolean,
    variantIds?: string[]
  ) => void;
  variantIds: string[];
  cells: Record<string, CellState>;
}) {
  const field = kind === "stock" ? "is_stocked" : "is_sellable";
  const enabled = kind === "stock" ? canStock : canSell;
  const label = kind === "stock" ? VISIBILITY_MATRIX_STOCK_LABEL : VISIBILITY_MATRIX_SELL_LABEL;
  return (
    <th
      className={cn(
        "px-2 py-1 text-center text-[11px] font-medium text-muted-foreground",
        showLeftBorder && "border-l border-border/60"
      )}
    >
      <div className="flex flex-col items-center gap-0.5">
        <span>{label}</span>
        {!readOnly && enabled ? (
          <BulkColumnCheckbox
            disabled={isPending}
            variantIds={variantIds}
            isOn={(variantId) => {
              const state = cells[cellKey(variantId, locationId)] ?? {
                is_stocked: false,
                is_sellable: false,
              };
              return state[field];
            }}
            ariaLabel={`Toggle ${label} for variants`}
            onCheckedChange={(checked) => onToggle(locationId, field, checked, variantIds)}
          />
        ) : null}
      </div>
    </th>
  );
}

/** Tri-state column bulk control — matches ProductListTable / VariantMatrixSelectHeader. */
function BulkColumnCheckbox({
  disabled,
  variantIds,
  isOn,
  ariaLabel,
  onCheckedChange,
}: {
  disabled?: boolean;
  variantIds: string[];
  isOn: (variantId: string) => boolean;
  ariaLabel: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  const allSelected =
    variantIds.length > 0 && variantIds.every((variantId) => isOn(variantId));
  const someSelected = variantIds.some((variantId) => isOn(variantId));

  return (
    <Checkbox
      checked={someSelected && !allSelected ? "indeterminate" : allSelected}
      disabled={disabled}
      aria-label={ariaLabel}
      onCheckedChange={(value) => onCheckedChange(value === true)}
    />
  );
}

function LocationVariantCell({
  kind,
  state,
  canStock,
  canSell,
  readOnly,
  isPending,
  showLeftBorder,
  onStockChange,
  onSellChange,
}: {
  kind: LocationColumnKind;
  state: CellState;
  canStock: boolean;
  canSell: boolean;
  readOnly: boolean;
  isPending: boolean;
  showLeftBorder: boolean;
  onStockChange: (checked: boolean) => void;
  onSellChange: (checked: boolean) => void;
}) {
  const isStock = kind === "stock";

  return (
    <td className={cn("px-2 py-1.5", showLeftBorder && "border-l border-border/40")}>
      <div className="flex items-center justify-center">
        <Checkbox
          checked={isStock ? state.is_stocked && canStock : state.is_sellable && canSell}
          disabled={readOnly || isPending || (isStock ? !canStock : !canSell)}
          aria-label={isStock ? "Stock at location" : "Sell at location"}
          onCheckedChange={(checked) =>
            isStock ? onStockChange(Boolean(checked)) : onSellChange(Boolean(checked))
          }
        />
      </div>
    </td>
  );
}
