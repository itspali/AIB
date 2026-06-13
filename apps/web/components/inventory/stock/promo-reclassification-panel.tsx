"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  createPromoReclassificationBatch,
  postPromoReclassificationBatch,
} from "@/app/inventory/stock/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PromoInventoryBalanceRow } from "@/lib/inventory/stock/promo-balances";
import {
  isPromoBalanceEligibleForReclassification,
  promotionalBatchStatusLabel,
  sumSelectedPromoBalanceQty,
  type PromotionalBatchRow,
} from "@/lib/procurement/promo/reclassification-helpers";
import { cn } from "@/lib/utils";

type Props = {
  balances: PromoInventoryBalanceRow[];
  draftBatches: PromotionalBatchRow[];
  onChanged: () => void;
  className?: string;
};

function formatQty(value: string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  return parsed.toFixed(4).replace(/\.?0+$/, "") || "0";
}

export function PromoReclassificationPanel({
  balances,
  draftBatches,
  onChanged,
  className,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  const eligibleBalances = useMemo(
    () => balances.filter(isPromoBalanceEligibleForReclassification),
    [balances]
  );

  const selectedQty = useMemo(
    () => sumSelectedPromoBalanceQty(eligibleBalances, selectedIds),
    [eligibleBalances, selectedIds]
  );

  const toggleBalance = (balanceId: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(balanceId);
      else next.delete(balanceId);
      return next;
    });
  };

  const handleCreateBatch = () => {
    const balanceIds = Array.from(selectedIds);
    if (balanceIds.length === 0) {
      toast.error("Select at least one promotional balance.");
      return;
    }

    startTransition(async () => {
      const result = await createPromoReclassificationBatch(balanceIds, notes.trim() || null);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to create reclassification batch.");
        return;
      }
      toast.success(`Draft batch ${result.batchNumber} created.`);
      setSelectedIds(new Set());
      setNotes("");
      onChanged();
    });
  };

  const handlePostBatch = (batchId: string, batchNumber: string) => {
    startTransition(async () => {
      const result = await postPromoReclassificationBatch(batchId);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to post reclassification batch.");
        return;
      }
      toast.success(
        `Batch ${batchNumber} posted — ${formatQty(String(result.quantityReclassified ?? 0))} units moved to sellable stock.`
      );
      onChanged();
    });
  };

  if (eligibleBalances.length === 0 && draftBatches.length === 0) {
    return null;
  }

  return (
    <section className={cn("mb-4 rounded-lg border border-border bg-muted/20 p-4", className)}>
      <div className="mb-3 flex items-start gap-2">
        <ArrowRightLeft className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div>
          <h2 className="text-sm font-semibold">Promotional reclassification</h2>
          <p className="text-xs text-muted-foreground">
            Move promotional or sample stock into sellable inventory at average cost.
          </p>
        </div>
      </div>

      {eligibleBalances.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Select balances for a new draft batch</p>
          <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
            {eligibleBalances.map((balance) => (
              <li key={balance.id} className="flex items-start gap-2">
                <Checkbox
                  id={`promo-balance-${balance.id}`}
                  checked={selectedIds.has(balance.id)}
                  disabled={isPending}
                  onCheckedChange={(checked) => toggleBalance(balance.id, checked === true)}
                />
                <label
                  htmlFor={`promo-balance-${balance.id}`}
                  className="min-w-0 flex-1 cursor-pointer"
                >
                  <span className="block truncate">
                    {balance.item_name} · {balance.variant_sku} · {balance.location_name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatQty(balance.quantity_on_hand)} · {balance.quarantine_type.replace(/_/g, " ")}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <div className="space-y-2">
            <Label htmlFor="promo-reclass-notes">Notes (optional)</Label>
            <Input
              id="promo-reclass-notes"
              value={notes}
              disabled={isPending}
              placeholder="Campaign end, clearance, etc."
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {selectedIds.size > 0
                ? `${selectedIds.size} balance${selectedIds.size === 1 ? "" : "s"} · ${formatQty(String(selectedQty))} units`
                : "No balances selected"}
            </p>
            <Button
              type="button"
              size="sm"
              disabled={isPending || selectedIds.size === 0}
              onClick={handleCreateBatch}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create draft batch
            </Button>
          </div>
        </div>
      ) : null}

      {draftBatches.length > 0 ? (
        <div className={cn("space-y-2", eligibleBalances.length > 0 && "mt-4 border-t border-border pt-4")}>
          <p className="text-xs font-medium text-muted-foreground">Draft batches</p>
          <ul className="space-y-2">
            {draftBatches.map((batch) => (
              <li
                key={batch.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/80 bg-background/60 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-medium">{batch.batch_number}</span>
                    <Badge variant="active">{promotionalBatchStatusLabel(batch.status)}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {batch.balance_count} balance{batch.balance_count === 1 ? "" : "s"}
                    {batch.notes ? ` · ${batch.notes}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={isPending}
                  onClick={() => handlePostBatch(batch.id, batch.batch_number)}
                >
                  Post to sellable stock
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
