"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  getVariantChannelAvailability,
  saveVariantChannelAvailability,
  type VariantChannelCell,
  type VariantChannelData,
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
  VISIBILITY_MATRIX_BULK_LIST,
  VISIBILITY_MATRIX_BULK_UNLIST,
  VISIBILITY_VARIANT_CHANNELS_EMPTY,
} from "@/lib/products/product-user-labels";
import type { ProductMasterFormValues, ProductVariantSnapshot } from "@/lib/products/types";

type Props = {
  itemId: string;
  variants: ProductVariantSnapshot[];
  /** Item-level channel listing — variant matrix only applies to listed channels. */
  storefrontVisibility?: ProductMasterFormValues["storefront_visibility"];
  readOnly?: boolean;
  embedded?: boolean;
};

type ChannelMeta = {
  id: string;
  name: string;
  channel_type: string;
};

function cellKey(variantId: string, channelId: string): string {
  return `${variantId}:${channelId}`;
}

function applyChannelData(
  data: VariantChannelData,
  setChannels: (channels: ChannelMeta[]) => void,
  setCells: (cells: Record<string, boolean>) => void
) {
  setChannels(data.channels);
  const map: Record<string, boolean> = {};
  for (const cell of data.cells) {
    map[cellKey(cell.variant_id, cell.storefront_id)] = cell.is_visible;
  }
  setCells(map);
}

export function VariantChannelAvailabilityMatrix({
  itemId,
  variants,
  storefrontVisibility = [],
  readOnly = false,
  embedded = false,
}: Props) {
  const router = useRouter();
  const extension = useOptionalItemExtensionData();
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<ChannelMeta[]>([]);
  const [cells, setCells] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();

  const activeVariants = useMemo(() => variants.filter((v) => v.is_active), [variants]);
  const activeVariantIds = useMemo(
    () => activeVariants.map((variant) => variant.id),
    [activeVariants]
  );
  const selection = useVariantMatrixSelection(activeVariantIds);

  const listedChannelIds = useMemo(
    () =>
      new Set(
        storefrontVisibility.filter((row) => row.is_visible).map((row) => row.storefront_id)
      ),
    [storefrontVisibility]
  );

  const listedChannels = useMemo(
    () => channels.filter((channel) => listedChannelIds.has(channel.id)),
    [channels, listedChannelIds]
  );

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getVariantChannelAvailability(itemId);
    if ("error" in result) {
      toast.error(result.error ?? "Unable to load channel availability.");
      setLoading(false);
      return;
    }
    applyChannelData(result.data, setChannels, setCells);
    setLoading(false);
  }, [itemId]);

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
    applyChannelData(extension.data.channels, setChannels, setCells);
    setLoading(false);
  }, [extension, load]);

  useEffect(() => {
    setCells((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const variant of activeVariants) {
        for (const channel of channels) {
          if (listedChannelIds.has(channel.id)) continue;
          const key = cellKey(variant.id, channel.id);
          if (key in next) {
            delete next[key];
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [activeVariants, channels, listedChannelIds]);

  const setCell = (variantId: string, channelId: string, visible: boolean) => {
    if (!listedChannelIds.has(channelId)) return;
    setCells((prev) => ({ ...prev, [cellKey(variantId, channelId)]: visible }));
  };

  const toggleColumn = (channelId: string, visible: boolean, variantIds = activeVariantIds) => {
    if (!listedChannelIds.has(channelId)) return;
    setCells((prev) => {
      const next = { ...prev };
      for (const variantId of variantIds) {
        next[cellKey(variantId, channelId)] = visible;
      }
      return next;
    });
  };

  const applyBulkListing = (visible: boolean) => {
    if (selection.selectedList.length === 0) return;
    setCells((prev) => {
      const next = { ...prev };
      for (const variantId of selection.selectedList) {
        for (const channel of listedChannels) {
          next[cellKey(variantId, channel.id)] = visible;
        }
      }
      return next;
    });
  };

  const handleSave = () => {
    const rows: VariantChannelCell[] = [];
    for (const variant of activeVariants) {
      for (const channel of listedChannels) {
        const visible = cells[cellKey(variant.id, channel.id)];
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
      toast.success("Channel availability saved.");
      router.refresh();
      void load();
    });
  };

  const shellClass = embedded ? "space-y-2" : "surface-panel space-y-4";

  if (loading) {
    return (
      <section className={shellClass}>
        <p className="text-sm text-muted-foreground">Loading channel availability…</p>
      </section>
    );
  }

  if (listedChannels.length === 0) {
    return (
      <section className={shellClass}>
        <p className="text-sm text-muted-foreground">{VISIBILITY_VARIANT_CHANNELS_EMPTY}</p>
      </section>
    );
  }

  return (
    <section className={shellClass}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {selection.someSelected && !readOnly ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">
              {selection.selectedList.length} selected
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => applyBulkListing(true)}
            >
              {VISIBILITY_MATRIX_BULK_LIST}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => applyBulkListing(false)}
            >
              {VISIBILITY_MATRIX_BULK_UNLIST}
            </Button>
          </div>
        ) : (
          <span />
        )}
        {!readOnly && (
          <Button type="button" size="sm" variant="outline" onClick={handleSave} disabled={isPending}>
            Save listings
          </Button>
        )}
      </div>

      <div
        className={
          embedded
            ? "table-chrome-frame overflow-x-auto rounded-md border border-border/60"
            : "surface-inset table-chrome-frame overflow-x-auto"
        }
      >
        <table data-header-tone="subtle" className="table-chrome w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="sticky left-0 z-10 w-10 px-2 py-1.5">
                {!readOnly ? (
                  <VariantMatrixSelectHeader
                    checked={selection.allSelected}
                    indeterminate={selection.someSelected && !selection.allSelected}
                    disabled={isPending || activeVariants.length === 0}
                    onCheckedChange={selection.toggleAll}
                  />
                ) : null}
              </th>
              <th className="sticky left-10 z-10 min-w-[7rem] px-2 py-1.5 text-xs font-medium text-muted-foreground">
                Variant
              </th>
              {listedChannels.map((channel) => (
                <th
                  key={channel.id}
                  className="px-2 py-1.5 text-center text-xs font-medium text-muted-foreground"
                >
                  <div className="flex flex-col items-center gap-1">
                    <span>{channel.name}</span>
                    <Badge variant="active">{channel.channel_type}</Badge>
                    {!readOnly && (
                      <div className="flex items-center gap-1 text-[11px] font-normal">
                        <button
                          type="button"
                          className="text-primary hover:underline disabled:opacity-50"
                          disabled={isPending}
                          onClick={() =>
                            toggleColumn(
                              channel.id,
                              true,
                              selection.someSelected ? selection.selectedList : activeVariantIds
                            )
                          }
                        >
                          {selection.someSelected ? "Sel" : "All"}
                        </button>
                        <span aria-hidden>·</span>
                        <button
                          type="button"
                          className="text-primary hover:underline disabled:opacity-50"
                          disabled={isPending}
                          onClick={() =>
                            toggleColumn(
                              channel.id,
                              false,
                              selection.someSelected ? selection.selectedList : activeVariantIds
                            )
                          }
                        >
                          None
                        </button>
                      </div>
                    )}
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
                    {variant.is_master && variant.is_sellable === false ? (
                      <Badge variant="default">Not sold</Badge>
                    ) : null}
                  </div>
                </td>
                {listedChannels.map((channel) => {
                  const visible = cells[cellKey(variant.id, channel.id)] ?? false;
                  return (
                    <td key={channel.id} className="px-2 py-1.5">
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={visible}
                          disabled={readOnly || isPending}
                          aria-label={`${variant.sku} visible on ${channel.name}`}
                          onCheckedChange={(checked) =>
                            setCell(variant.id, channel.id, Boolean(checked))
                          }
                        />
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
