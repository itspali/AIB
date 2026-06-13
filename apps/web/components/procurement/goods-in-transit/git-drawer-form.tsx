"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { postGoodsInTransit } from "@/app/procurement/goods-in-transit/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RightDrawer } from "@/components/ui/right-drawer";
import type { GoodsInTransitRow } from "@/lib/procurement/git/types";
import { gitVoucherStatusLabel } from "@/lib/procurement/git/types";
import type { ReceivablePurchaseOrderOption } from "@/lib/procurement/purchase-orders/types";
import type { ProcurementLocationOption } from "@/lib/procurement/shared/types";
import { formatDate } from "@/lib/dashboard/format";

type GitLineDraft = {
  variant_id: string;
  po_item_id: string | null;
  quantity: string;
  unit_cost: string;
  label: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceLocations: ProcurementLocationOption[];
  gitLocations: Array<{ id: string; name: string; code: string }>;
  receivableOrders: ReceivablePurchaseOrderOption[];
  onPosted: () => void;
};

export function GitDrawerForm({
  open,
  onOpenChange,
  sourceLocations,
  gitLocations,
  receivableOrders,
  onPosted,
}: Props) {
  const [sourceLocationId, setSourceLocationId] = useState("");
  const [gitLocationId, setGitLocationId] = useState("");
  const [purchaseOrderId, setPurchaseOrderId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<GitLineDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedPo = useMemo(
    () => receivableOrders.find((order) => order.id === purchaseOrderId) ?? null,
    [purchaseOrderId, receivableOrders]
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSourceLocationId("");
    setGitLocationId(gitLocations[0]?.id ?? "");
    setPurchaseOrderId(null);
    setNotes("");
    setLines([]);
  }, [open, gitLocations]);

  useEffect(() => {
    if (!purchaseOrderId || !selectedPo) {
      setLines([]);
      return;
    }
    setSourceLocationId(selectedPo.destination_location_id);
    setLines(
      selectedPo.lines
        .filter((line) => Number(line.open_quantity) > 0 && !line.is_promotional)
        .map((line) => ({
          variant_id: line.variant_id,
          po_item_id: line.id,
          quantity: line.open_quantity,
          unit_cost: line.unit_price_contractual,
          label: `${line.item_name} · ${line.variant_sku}`,
        }))
    );
  }, [purchaseOrderId, selectedPo]);

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const result = await postGoodsInTransit({
        source_location_id: sourceLocationId,
        git_holding_location_id: gitLocationId,
        purchase_order_id: purchaseOrderId,
        notes: notes.trim() || null,
        lines: lines.map((line) => ({
          variant_id: line.variant_id,
          po_item_id: line.po_item_id,
          quantity: line.quantity,
          unit_cost: line.unit_cost,
        })),
      });

      if ("error" in result) {
        setError(result.error ?? "Unable to post GIT voucher.");
        return;
      }

      toast.success(`GIT voucher ${result.voucherNumber} posted.`);
      onOpenChange(false);
      onPosted();
    });
  };

  if (!open) return null;

  return (
    <RightDrawer open={open} onOpenChange={onOpenChange} title="Post goods in transit">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Purchase order (optional)</Label>
          <Select
            value={purchaseOrderId ?? "none"}
            onValueChange={(value) => setPurchaseOrderId(value === "none" ? null : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Standalone GIT move" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Standalone GIT move</SelectItem>
              {receivableOrders.map((order) => (
                <SelectItem key={order.id} value={order.id}>
                  {order.voucher_number} — {order.supplier_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Source location</Label>
            <Select value={sourceLocationId} onValueChange={setSourceLocationId}>
              <SelectTrigger>
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                {sourceLocations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>GIT holding location</Label>
            <Select value={gitLocationId} onValueChange={setGitLocationId}>
              <SelectTrigger>
                <SelectValue placeholder="Select GIT node" />
              </SelectTrigger>
              <SelectContent>
                {gitLocations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {lines.length > 0 ? (
          <ul className="space-y-2 rounded-lg border border-border p-3 text-sm">
            {lines.map((line) => (
              <li key={line.variant_id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">{line.label}</span>
                <Input
                  className="w-24 text-right font-mono"
                  value={line.quantity}
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((entry) =>
                        entry.variant_id === line.variant_id
                          ? { ...entry, quantity: event.target.value }
                          : entry
                      )
                    )
                  }
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Select a purchase order to prefill open lines, or configure GIT locations under Settings
            → Locations first.
          </p>
        )}

        <div className="space-y-2">
          <Label>Notes</Label>
          <Input value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" disabled={isPending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isPending || !sourceLocationId || !gitLocationId || lines.length === 0}
            onClick={handleSubmit}
          >
            {isPending ? "Posting…" : "Post to GIT"}
          </Button>
        </div>
      </div>
    </RightDrawer>
  );
}

type ListProps = {
  vouchers: GoodsInTransitRow[];
  onCreate: () => void;
  onRefresh: () => void;
};

export function GitVoucherList({ vouchers, onCreate, onRefresh }: ListProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Track inventory moved to in-transit holding locations before warehouse receipt.
        </p>
        <Button type="button" size="sm" onClick={onCreate}>
          Post GIT
        </Button>
      </div>

      {vouchers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No goods-in-transit vouchers yet. Flag a virtual location as GIT holding under Settings →
          Locations, then post a move from a source warehouse.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {vouchers.map((voucher) => (
            <li key={voucher.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-medium">{voucher.voucher_number}</span>
                  <Badge variant={voucher.status === "POSTED" ? "active" : "completed"}>
                    {gitVoucherStatusLabel(voucher.status)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {voucher.source_location_name} → {voucher.git_holding_location_name}
                  {voucher.purchase_order_number ? ` · PO ${voucher.purchase_order_number}` : ""}
                  {voucher.posted_at ? ` · ${formatDate(voucher.posted_at)}` : ""}
                </p>
              </div>
              <span className="text-sm font-medium">{voucher.line_count} lines</span>
            </li>
          ))}
        </ul>
      )}

      <Button type="button" variant="outline" size="sm" onClick={onRefresh}>
        Refresh
      </Button>
    </div>
  );
}
