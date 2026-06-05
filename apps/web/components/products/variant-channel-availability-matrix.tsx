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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { ProductVariantSnapshot } from "@/lib/products/types";

type Props = {
  itemId: string;
  variants: ProductVariantSnapshot[];
  readOnly?: boolean;
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

export function VariantChannelAvailabilityMatrix({ itemId, variants, readOnly = false }: Props) {
  const router = useRouter();
  const extension = useOptionalItemExtensionData();
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<ChannelMeta[]>([]);
  const [cells, setCells] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();

  const activeVariants = useMemo(() => variants.filter((v) => v.is_active), [variants]);

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

  const setCell = (variantId: string, channelId: string, visible: boolean) => {
    setCells((prev) => ({ ...prev, [cellKey(variantId, channelId)]: visible }));
  };

  const toggleColumn = (channelId: string, visible: boolean) => {
    setCells((prev) => {
      const next = { ...prev };
      for (const variant of activeVariants) {
        next[cellKey(variant.id, channelId)] = visible;
      }
      return next;
    });
  };

  const handleSave = () => {
    const rows: VariantChannelCell[] = [];
    for (const variant of activeVariants) {
      for (const channel of channels) {
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

  if (loading) {
    return (
      <section className="surface-panel">
        <p className="text-sm text-muted-foreground">Loading channel availability…</p>
      </section>
    );
  }

  if (channels.length === 0) {
    return (
      <section className="surface-panel space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Variant Channel Availability
        </h3>
        <p className="text-sm text-muted-foreground">
          No active storefront channels yet. Configure channels to control which variants are listed
          per channel.
        </p>
      </section>
    );
  }

  return (
    <section className="surface-panel space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Variant Channel Availability
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Choose which variants are visible on each storefront channel. This refines the
            product-level defaults set above.
          </p>
        </div>
        {!readOnly && (
          <Button type="button" size="sm" onClick={handleSave} disabled={isPending}>
            Save availability
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
              {channels.map((channel) => (
                <th key={channel.id} className="p-3 text-center font-medium text-muted-foreground">
                  <div className="flex flex-col items-center gap-1">
                    <span>{channel.name}</span>
                    <Badge variant="active">{channel.channel_type}</Badge>
                    {!readOnly && (
                      <div className="flex items-center gap-1 text-[11px] font-normal">
                        <button
                          type="button"
                          className="text-primary hover:underline disabled:opacity-50"
                          disabled={isPending}
                          onClick={() => toggleColumn(channel.id, true)}
                        >
                          All
                        </button>
                        <span aria-hidden>·</span>
                        <button
                          type="button"
                          className="text-primary hover:underline disabled:opacity-50"
                          disabled={isPending}
                          onClick={() => toggleColumn(channel.id, false)}
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
                <td className="sticky left-0 z-10 bg-background p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{variant.sku}</span>
                    {variant.is_master && variant.is_sellable === false ? (
                      <Badge variant="default">Not sold</Badge>
                    ) : null}
                  </div>
                </td>
                {channels.map((channel) => {
                  const visible = cells[cellKey(variant.id, channel.id)] ?? false;
                  return (
                    <td key={channel.id} className="p-3">
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
