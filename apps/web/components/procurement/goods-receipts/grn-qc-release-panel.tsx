"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  releaseGoodsReceiptFromQc,
  releaseGoodsReceiptLineFromQc,
} from "@/app/procurement/goods-receipts/actions";
import {
  GRN_REJECT_DISPOSITIONS,
  grnRejectDispositionLabel,
  type GrnRejectDisposition,
} from "@/lib/procurement/goods-receipts/grn-reject-dispositions";
import {
  grnLineQcHoldQuantity,
  grnLinesAwaitingQcRelease,
  parseGrnQcReleaseQuantities,
  syncGrnQcPassQuantity,
  syncGrnQcRejectQuantity,
} from "@/lib/procurement/goods-receipts/grn-qc-release";
import type { GoodsReceiptLineRow } from "@/lib/procurement/goods-receipts/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Props = {
  goodsReceiptId: string;
  isQcPending: boolean;
  qcLines: GoodsReceiptLineRow[];
  onReleased: () => void | Promise<void>;
};

type LineDraft = {
  pass: string;
  reject: string;
  disposition: GrnRejectDisposition;
};

function defaultLineDraft(line: GoodsReceiptLineRow): LineDraft {
  const onHold = grnLineQcHoldQuantity(line);
  return {
    pass: String(onHold),
    reject: "0",
    disposition: "SCRAP",
  };
}

export function GrnQcReleasePanel({
  goodsReceiptId,
  isQcPending,
  qcLines,
  onReleased,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [lineDrafts, setLineDrafts] = useState<Record<string, LineDraft>>({});

  const pendingLines = useMemo(() => grnLinesAwaitingQcRelease(qcLines), [qcLines]);

  if (!isQcPending) {
    return (
      <Badge variant="completed" className="text-xs font-normal">
        QC cleared — stock posted
      </Badge>
    );
  }

  if (pendingLines.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-muted/20 p-4">
        <Badge variant="completed" className="text-xs font-normal">
          QC cleared — stock posted
        </Badge>
      </section>
    );
  }

  const handleReleaseAll = () => {
    startTransition(async () => {
      const result = await releaseGoodsReceiptFromQc(goodsReceiptId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("All accepted units posted to stock.");
      setLineDrafts({});
      await onReleased();
    });
  };

  const handleReleaseLine = (line: GoodsReceiptLineRow) => {
    const onHold = grnLineQcHoldQuantity(line);
    const draft = lineDrafts[line.id] ?? defaultLineDraft(line);
    const parsed = parseGrnQcReleaseQuantities(onHold, draft.pass, draft.reject);
    if (parsed.error) {
      toast.error(parsed.error);
      return;
    }

    startTransition(async () => {
      const result = await releaseGoodsReceiptLineFromQc({
        goods_receipt_item_id: line.id,
        quantity_released: String(parsed.pass),
        quantity_failed: String(parsed.reject),
        failed_disposition: parsed.reject > 0 ? draft.disposition : undefined,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Line inspection recorded.");
      setLineDrafts({});
      await onReleased();
    });
  };

  const patchLineDraft = (
    line: GoodsReceiptLineRow,
    patch: Partial<LineDraft> | ((current: LineDraft) => LineDraft)
  ) => {
    setLineDrafts((prev) => {
      const current = prev[line.id] ?? defaultLineDraft(line);
      const next = typeof patch === "function" ? patch(current) : { ...current, ...patch };
      return { ...prev, [line.id]: next };
    });
  };

  return (
    <section className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Quality inspection</h3>
          <p className="text-xs text-muted-foreground">
            Post accepted units line-by-line, or accept the entire receipt at once. Pass and reject
            always total the on-hold quantity.
          </p>
        </div>
        <Badge variant="action_required" className="shrink-0 text-xs font-normal">
          QC pending
        </Badge>
      </div>

      <div className="overflow-x-auto rounded-md border border-border bg-background">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Item</th>
              <th className="w-[4.5rem] px-2 py-2 text-right font-medium">On hold</th>
              <th className="w-[5.5rem] px-2 py-2 text-left font-medium">Pass to stock</th>
              <th className="w-[5rem] px-2 py-2 text-left font-medium">Reject</th>
              <th className="w-[8.5rem] px-2 py-2 text-left font-medium">Reject as</th>
              <th className="w-[5.5rem] px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {pendingLines.map((line) => {
              const onHold = grnLineQcHoldQuantity(line);
              const draft = lineDrafts[line.id] ?? defaultLineDraft(line);
              const rejectQty = draft.reject.trim() === "" ? 0 : Number(draft.reject);
              const showRejectDisposition = Number.isFinite(rejectQty) && rejectQty > 0;

              return (
                <tr key={line.id} className="border-b border-border/70 last:border-b-0">
                  <td className="px-3 py-2 align-middle">
                    <p className="font-medium leading-tight">{line.item_name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{line.variant_sku}</p>
                  </td>
                  <td className="px-2 py-2 text-right align-middle tabular-nums">{onHold}</td>
                  <td className="px-2 py-2 align-middle">
                    <Input
                      className="h-8 tabular-nums"
                      inputMode="decimal"
                      aria-label={`Pass to stock for ${line.variant_sku}`}
                      value={draft.pass}
                      disabled={isPending}
                      onChange={(event) =>
                        patchLineDraft(line, (current) => ({
                          ...current,
                          ...syncGrnQcPassQuantity(onHold, event.target.value),
                        }))
                      }
                    />
                  </td>
                  <td className="px-2 py-2 align-middle">
                    <Input
                      className="h-8 tabular-nums"
                      inputMode="decimal"
                      aria-label={`Reject quantity for ${line.variant_sku}`}
                      value={draft.reject}
                      disabled={isPending}
                      onChange={(event) =>
                        patchLineDraft(line, (current) => ({
                          ...current,
                          ...syncGrnQcRejectQuantity(onHold, event.target.value),
                        }))
                      }
                    />
                  </td>
                  <td className="px-2 py-2 align-middle">
                    <Select
                      value={draft.disposition}
                      disabled={!showRejectDisposition || isPending}
                      onValueChange={(value) =>
                        patchLineDraft(line, { disposition: value as GrnRejectDisposition })
                      }
                    >
                      <SelectTrigger
                        className={cn("h-8 text-xs", !showRejectDisposition && "opacity-60")}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GRN_REJECT_DISPOSITIONS.map((disposition) => (
                          <SelectItem key={disposition} value={disposition}>
                            {grnRejectDispositionLabel(disposition)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2 py-2 align-middle">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      disabled={isPending}
                      onClick={() => handleReleaseLine(line)}
                    >
                      Apply
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Button type="button" size="sm" disabled={isPending} onClick={handleReleaseAll}>
        {isPending ? "Posting…" : "Accept all & post to stock"}
      </Button>
    </section>
  );
}
