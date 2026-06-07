"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  getItemBufferThresholds,
  getVariantAssortment,
  getVariantChannelAvailability,
  saveItemBufferThresholds,
  saveVariantAssortment,
  saveVariantChannelAvailability,
  type BufferThresholdData,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  buildBufferThresholdSaveRows,
  bufferCellKey,
  formatBufferQuantity,
  resolveBufferReorderDisplay,
} from "@/lib/products/buffer-thresholds";
import {
  VISIBILITY_MATRIX_REORDER_LABEL,
  VISIBILITY_MATRIX_SELL_LABEL,
  VISIBILITY_MATRIX_SHOW_REORDER_LEVELS,
  VISIBILITY_MATRIX_STOCK_LABEL,
} from "@/lib/products/product-user-labels";
import type { ProductMasterFormValues, ProductVariantSnapshot } from "@/lib/products/types";
import { cn } from "@/lib/utils";

export type ReachPersistFailures = {
  locations?: string;
  reorder?: string;
  channels?: string;
};

export type ReachPersistResult = { ok: true } | { ok: false; failures: ReachPersistFailures };

export type ReachPersistOptions = {
  storefrontVisibility?: ProductMasterFormValues["storefront_visibility"];
};

export type VariantAssortmentMatrixHandle = {
  persist: (options?: ReachPersistOptions) => Promise<ReachPersistResult>;
};

type Props = {
  itemId: string;
  variants: ProductVariantSnapshot[];
  /** When channels are listed, show sellable variant rows only. */
  sellableVariantsOnly?: boolean;
  /** Enables reorder persistence and the optional reorder column toggle. */
  trackInventory?: boolean;
  /** Product default reorder; blank cells inherit this value. */
  defaultReorderPoint?: string;
  /** Hide the local save button; parent persists via {@link VariantAssortmentMatrixHandle}. */
  deferSaveToParent?: boolean;
  storefrontVisibility?: ProductMasterFormValues["storefront_visibility"];
  /** Shown after a deferred parent save when Reach persistence failed. */
  persistError?: string;
  readOnly?: boolean;
  embedded?: boolean;
};

type VariantAssortmentMatrixProps = Props;

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

type LocationColumnKind = "stock" | "reorder" | "sell";

type CellState = { is_stocked: boolean; is_sellable: boolean };

/** Fixed sub-column widths — table uses w-max so overflow scrolls instead of cramping. */
const MATRIX_STOCK_COL_CLASS = "w-12 min-w-12 shrink-0";
const MATRIX_REORDER_COL_CLASS = "w-14 min-w-14 shrink-0";
const MATRIX_SELL_COL_CLASS = "w-12 min-w-12 shrink-0";

function matrixSubcolumnClass(kind: LocationColumnKind): string {
  if (kind === "reorder") return MATRIX_REORDER_COL_CLASS;
  if (kind === "stock") return MATRIX_STOCK_COL_CLASS;
  return MATRIX_SELL_COL_CLASS;
}

function cellKey(variantId: string, locationId: string): string {
  return `${variantId}:${locationId}`;
}

function channelCellKey(variantId: string, channelId: string): string {
  return `${variantId}:${channelId}`;
}

function resolveListedChannelIds(
  storefrontVisibility: ProductMasterFormValues["storefront_visibility"]
): Set<string> {
  return new Set(
    storefrontVisibility.filter((row) => row.is_visible).map((row) => row.storefront_id)
  );
}

function buildChannelSaveRows(
  variants: ProductVariantSnapshot[],
  channels: ChannelMeta[],
  listedChannelIds: Set<string>,
  channelCells: Record<string, boolean>
): VariantChannelCell[] {
  const rows: VariantChannelCell[] = [];
  for (const variant of variants) {
    for (const channel of channels) {
      if (!listedChannelIds.has(channel.id)) continue;
      const visible = channelCells[channelCellKey(variant.id, channel.id)];
      if (visible === undefined) continue;
      rows.push({
        storefront_id: channel.id,
        variant_id: variant.id,
        is_visible: visible,
      });
    }
  }
  return rows;
}

function locationSupportsStock(location: LocationMeta): boolean {
  return location.is_stock_holding && location.presence_type !== "VIRTUAL";
}

function locationSupportsSell(location: LocationMeta): boolean {
  return location.is_commercial_storefront;
}

function locationColumns(location: LocationMeta, showReorder: boolean): LocationColumnKind[] {
  const columns: LocationColumnKind[] = [];
  if (locationSupportsStock(location)) {
    columns.push("stock");
    if (showReorder) columns.push("reorder");
  }
  if (locationSupportsSell(location)) columns.push("sell");
  return columns;
}

function applyBufferThresholdData(
  data: BufferThresholdData,
  setReorderCells: (cells: Record<string, string>) => void,
  setReorderOverrides: (overrides: Record<string, boolean>) => void
) {
  const nextCells: Record<string, string> = {};
  const nextOverrides: Record<string, boolean> = {};
  for (const cell of data.cells) {
    const key = bufferCellKey(cell.variant_id, cell.location_id);
    nextCells[key] = formatBufferQuantity(cell.reorder_point_qty);
    nextOverrides[key] = true;
  }
  setReorderCells(nextCells);
  setReorderOverrides(nextOverrides);
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

export const VariantAssortmentMatrix = forwardRef<
  VariantAssortmentMatrixHandle,
  VariantAssortmentMatrixProps
>(function VariantAssortmentMatrix(
  {
    itemId,
    variants,
    sellableVariantsOnly = false,
    trackInventory = false,
    defaultReorderPoint = "",
    deferSaveToParent = false,
    storefrontVisibility = [],
    persistError,
    readOnly = false,
    embedded = false,
  },
  ref
) {
  const router = useRouter();
  const extension = useOptionalItemExtensionData();
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<LocationMeta[]>([]);
  const [cells, setCells] = useState<Record<string, CellState>>({});
  const [channels, setChannels] = useState<ChannelMeta[]>([]);
  const [channelCells, setChannelCells] = useState<Record<string, boolean>>({});
  const [reorderCells, setReorderCells] = useState<Record<string, string>>({});
  const [reorderOverrides, setReorderOverrides] = useState<Record<string, boolean>>({});
  const [showReorderColumns, setShowReorderColumns] = useState(false);
  const [isPending, startTransition] = useTransition();

  const showReorderInGrid = trackInventory && showReorderColumns;

  const activeVariants = useMemo(() => {
    const active = variants.filter((variant) => variant.is_active);
    const restrictToSellable = sellableVariantsOnly || trackInventory;
    if (!restrictToSellable) return active;
    const sellable = active.filter((variant) => variant.is_sellable !== false);
    return sellable.length > 0 ? sellable : active;
  }, [sellableVariantsOnly, trackInventory, variants]);

  const activeVariantIds = useMemo(
    () => activeVariants.map((variant) => variant.id),
    [activeVariants]
  );
  const selection = useVariantMatrixSelection(activeVariantIds);

  const visibleLocations = useMemo(
    () => locations.filter((location) => locationColumns(location, showReorderInGrid).length > 0),
    [locations, showReorderInGrid]
  );

  const stockLocationIds = useMemo(
    () =>
      locations
        .filter((location) => locationSupportsStock(location))
        .map((location) => location.id),
    [locations]
  );

  const listedChannelIds = useMemo(
    () => resolveListedChannelIds(storefrontVisibility),
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
    const [assortmentResult, channelResult, bufferResult] = await Promise.all([
      getVariantAssortment(itemId),
      getVariantChannelAvailability(itemId),
      trackInventory ? getItemBufferThresholds(itemId) : Promise.resolve(null),
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
    if (bufferResult && "error" in bufferResult) {
      toast.error(bufferResult.error ?? "Unable to load reorder thresholds.");
      setLoading(false);
      return;
    }
    applyAssortmentData(assortmentResult.data, setLocations, setCells);
    applyChannelData(channelResult.data.channels, channelResult.data.cells);
    if (bufferResult && "data" in bufferResult) {
      applyBufferThresholdData(bufferResult.data, setReorderCells, setReorderOverrides);
    }
    setLoading(false);
  }, [applyChannelData, itemId, trackInventory]);

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
    if (trackInventory) {
      applyBufferThresholdData(
        extension.data.bufferThresholds,
        setReorderCells,
        setReorderOverrides
      );
    }
    setLoading(false);
  }, [applyChannelData, extension, load, trackInventory]);

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

  const setReorderCell = (variantId: string, locationId: string, value: string) => {
    const key = bufferCellKey(variantId, locationId);
    setReorderCells((prev) => ({ ...prev, [key]: value }));
    setReorderOverrides((prev) => ({
      ...prev,
      [key]: value.trim() !== "" ? true : prev[key] ?? false,
    }));
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
    startTransition(async () => {
      const result = await persistReach({
        storefrontVisibility,
        channelsOnly: true,
      });
      if (!result.ok) {
        const message =
          result.failures.channels ??
          result.failures.locations ??
          result.failures.reorder ??
          "Unable to save channel availability.";
        toast.error(message);
        return;
      }
      toast.success("Channel listings saved.");
      router.refresh();
      void load();
    });
  };

  const persistReach = useCallback(
    async (
      options?: ReachPersistOptions & { channelsOnly?: boolean }
    ): Promise<ReachPersistResult> => {
      const failures: ReachPersistFailures = {};
      const visibility = options?.storefrontVisibility ?? storefrontVisibility;
      const listedIds = resolveListedChannelIds(visibility);
      const hasListedChannels = listedIds.size > 0;
      const saveLocations = !options?.channelsOnly;
      const saveChannels = options?.channelsOnly || hasListedChannels;

      if (saveLocations) {
        const rows: VariantAssortmentCell[] = [];
        for (const variant of activeVariants) {
          for (const location of locations.filter(
            (entry) => locationColumns(entry, false).length > 0
          )) {
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

        const result = await saveVariantAssortment(itemId, rows);
        if ("error" in result) {
          failures.locations = result.error ?? "Unable to save assortment.";
        } else if (trackInventory) {
          const reorderRows = buildBufferThresholdSaveRows(
            activeVariantIds,
            stockLocationIds,
            reorderCells,
            reorderOverrides
          );
          const reorderResult = await saveItemBufferThresholds(itemId, reorderRows);
          if ("error" in reorderResult) {
            failures.reorder = reorderResult.error ?? "Unable to save reorder thresholds.";
          }
        }
      }

      if (saveChannels && hasListedChannels) {
        const channelRows = buildChannelSaveRows(
          activeVariants,
          channels,
          listedIds,
          channelCells
        );
        const channelResult = await saveVariantChannelAvailability(itemId, channelRows);
        if ("error" in channelResult) {
          failures.channels =
            channelResult.error ?? "Unable to save channel availability.";
        }
      }

      if (Object.keys(failures).length > 0) {
        return { ok: false, failures };
      }
      return { ok: true };
    },
    [
      activeVariantIds,
      activeVariants,
      cells,
      channelCells,
      channels,
      itemId,
      locations,
      reorderCells,
      reorderOverrides,
      stockLocationIds,
      storefrontVisibility,
      trackInventory,
    ]
  );

  useImperativeHandle(ref, () => ({ persist: persistReach }), [persistReach]);

  const handleSave = () => {
    startTransition(async () => {
      const result = await persistReach({ storefrontVisibility });
      if (!result.ok) {
        const message =
          result.failures.locations ??
          result.failures.reorder ??
          result.failures.channels ??
          "Unable to save locations.";
        toast.error(message);
        return;
      }
      toast.success("Locations saved.");
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
      {persistError ? (
        <p className="text-xs text-destructive" role="alert">
          {persistError}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="mr-auto flex flex-wrap items-center gap-3">
          {trackInventory && !readOnly ? (
            <div className="flex items-center gap-2">
              <Switch
                id={`show-reorder-levels-${itemId}`}
                checked={showReorderColumns}
                disabled={isPending}
                onCheckedChange={setShowReorderColumns}
              />
              <Label
                htmlFor={`show-reorder-levels-${itemId}`}
                className="text-xs font-normal text-muted-foreground"
              >
                {VISIBILITY_MATRIX_SHOW_REORDER_LEVELS}
              </Label>
            </div>
          ) : null}
          {selection.someSelected ? (
            <span className="text-xs text-muted-foreground">
              {selection.selectedList.length} variant
              {selection.selectedList.length === 1 ? "" : "s"} selected
            </span>
          ) : null}
        </div>
        {!readOnly && !deferSaveToParent && visibleLocations.length > 0 ? (
          <Button type="button" size="sm" variant="outline" onClick={handleSave} disabled={isPending}>
            Save locations
          </Button>
        ) : null}
        {!readOnly && !deferSaveToParent && showChannelColumns ? (
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
                const columns = locationColumns(location, showReorderInGrid);
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
                const columns = locationColumns(location, showReorderInGrid);
                return columns.map((kind, index) =>
                  kind === "reorder" ? (
                    <LocationReorderBulkHeader
                      key={`${location.id}-${kind}`}
                      showLeftBorder={index === 0}
                    />
                  ) : (
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
                  )
                );
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
                  const columns = locationColumns(location, showReorderInGrid);
                  return columns.map((kind, index) =>
                    kind === "reorder" ? (
                      <LocationReorderCell
                        key={`${location.id}-${kind}`}
                        variantSku={variant.sku}
                        locationName={location.name}
                        enabled={locationSupportsStock(location)}
                        display={resolveBufferReorderDisplay(
                          reorderCells[bufferCellKey(variant.id, location.id)],
                          defaultReorderPoint
                        )}
                        readOnly={readOnly}
                        isPending={isPending}
                        showLeftBorder={index === 0}
                        onChange={(value) => setReorderCell(variant.id, location.id, value)}
                      />
                    ) : (
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
                    )
                  );
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
});

function MatrixSubcolumnHeader({
  label,
  widthClass,
  showLeftBorder,
  control,
}: {
  label: string;
  widthClass: string;
  showLeftBorder: boolean;
  control?: ReactNode;
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
        <div className="flex h-4 w-4 items-center justify-center">
          {control ?? <span className="h-4 w-4 shrink-0" aria-hidden />}
        </div>
      </div>
    </th>
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
  kind: Exclude<LocationColumnKind, "reorder">;
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
    <MatrixSubcolumnHeader
      label={label}
      widthClass={matrixSubcolumnClass(kind)}
      showLeftBorder={showLeftBorder}
      control={
        !readOnly && enabled ? (
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
        ) : undefined
      }
    />
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

function LocationReorderBulkHeader({ showLeftBorder }: { showLeftBorder: boolean }) {
  return (
    <MatrixSubcolumnHeader
      label={VISIBILITY_MATRIX_REORDER_LABEL}
      widthClass={MATRIX_REORDER_COL_CLASS}
      showLeftBorder={showLeftBorder}
    />
  );
}

function LocationReorderCell({
  variantSku,
  locationName,
  enabled,
  display,
  readOnly,
  isPending,
  showLeftBorder,
  onChange,
}: {
  variantSku: string;
  locationName: string;
  /** Storage location column — reorder is editable independent of Stock checkbox. */
  enabled: boolean;
  display: ReturnType<typeof resolveBufferReorderDisplay>;
  readOnly: boolean;
  isPending: boolean;
  showLeftBorder: boolean;
  onChange: (value: string) => void;
}) {
  const inheritedHint =
    display.inherited && display.placeholder && display.placeholder !== "Default"
      ? `Default: ${display.placeholder}`
      : display.inherited
        ? "Uses product default"
        : undefined;

  return (
    <td
      className={cn(
        MATRIX_REORDER_COL_CLASS,
        "px-1 py-1.5 align-middle",
        showLeftBorder && "border-l border-border/40"
      )}
    >
      <Input
        className={cn(
          "h-7 w-full min-w-0 max-w-full px-1 text-right font-mono text-[11px]",
          display.inherited && "text-muted-foreground"
        )}
        inputMode="decimal"
        value={display.value}
        placeholder=""
        title={inheritedHint}
        disabled={readOnly || isPending || !enabled}
        aria-label={`Reorder for ${variantSku} at ${locationName}${inheritedHint ? ` (${inheritedHint})` : ""}`}
        onChange={(event) => onChange(event.target.value)}
      />
    </td>
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
  kind: Exclude<LocationColumnKind, "reorder">;
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
    <td
      className={cn(
        matrixSubcolumnClass(kind),
        "px-1 py-1.5 align-middle",
        showLeftBorder && "border-l border-border/40"
      )}
    >
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
