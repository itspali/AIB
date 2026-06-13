"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { releaseGoodsReceiptFromQc } from "@/app/procurement/goods-receipts/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Props = {
  goodsReceiptId: string;
  isQcPending: boolean;
  onReleased: () => void;
};

export function GrnQcReleasePanel({ goodsReceiptId, isQcPending, onReleased }: Props) {
  const [isPending, startTransition] = useTransition();

  if (!isQcPending) {
    return (
      <Badge variant="completed" className="text-xs font-normal">
        QC cleared
      </Badge>
    );
  }

  const handleRelease = () => {
    startTransition(async () => {
      const result = await releaseGoodsReceiptFromQc(goodsReceiptId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Goods receipt released from quality hold.");
      onReleased();
    });
  };

  return (
    <section className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Quality inspection</h3>
          <p className="text-xs text-muted-foreground">
            Paid stock from this receipt is held in the QC sub-pool until inspection passes. Release
            posts purchase-receipt ledger entries and moves quantities into sellable inventory.
          </p>
        </div>
        <Badge variant="action_required" className="shrink-0 text-xs font-normal">
          QC pending
        </Badge>
      </div>
      <Button type="button" size="sm" disabled={isPending} onClick={handleRelease}>
        {isPending ? "Releasing…" : "Release from QC hold"}
      </Button>
    </section>
  );
}
