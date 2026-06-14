"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  releaseGoodsReceiptFromQc,
  releaseGoodsReceiptLineFromQc,
} from "@/app/procurement/goods-receipts/actions";
import type { GoodsReceiptLineRow } from "@/lib/procurement/goods-receipts/types";
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
import { GRN_REJECT_DISPOSITIONS } from "@/components/procurement/goods-receipts/grn-line-entry-table";

type Props = {
  goodsReceiptId: string;
  isQcPending: boolean;
  qcLines: GoodsReceiptLineRow[];
  onReleased: () => void;
};

export function GrnQcReleasePanel({
  goodsReceiptId,
  isQcPending,
  qcLines,
  onReleased,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [lineDrafts, setLineDrafts] = useState<Record<string, { release: string; fail: string; disposition: string }>>(
    {}
  );

  if (!isQcPending) {
    return (
      <Badge variant="completed" className="text-xs font-normal">
        QC cleared
      </Badge>
    );
  }

  const handleReleaseAll = () => {
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

  const handleReleaseLine = (line: GoodsReceiptLineRow) => {
    const draft = lineDrafts[line.id] ?? {
      release: line.quantity_accepted,
      fail: "0",
      disposition: "SCRAP",
    };
    startTransition(async () => {
      const result = await releaseGoodsReceiptLineFromQc({
        goods_receipt_item_id: line.id,
        quantity_released: draft.release,
        quantity_failed: draft.fail,
        failed_disposition: draft.disposition as "RTV" | "SCRAP" | "DAMAGE" | "SHRINK",
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("QC line updated.");
      onReleased();
    });
  };

  const routableLines = qcLines.filter((line) => line.id);

  return (
    <section className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Quality inspection</h3>
          <p className="text-xs text-muted-foreground">
            Release accepted quantities line-by-line or release the entire receipt at once.
          </p>
        </div>
        <Badge variant="action_required" className="shrink-0 text-xs font-normal">
          QC pending
        </Badge>
      </div>

      {routableLines.length > 0 ? (
        <ul className="space-y-2">
          {routableLines.map((line) => {
            const draft = lineDrafts[line.id] ?? {
              release: line.quantity_accepted,
              fail: "0",
              disposition: "SCRAP",
            };
            return (
              <li
                key={line.id}
                className="grid gap-2 rounded-md border border-border bg-background p-3 md:grid-cols-[1fr_repeat(3,minmax(0,5rem))_auto]"
              >
                <div className="min-w-0 text-sm">
                  <p className="font-medium">{line.item_name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{line.variant_sku}</p>
                </div>
                <div>
                  <Label className="text-xs">Release</Label>
                  <Input
                    className="h-8"
                    value={draft.release}
                    onChange={(e) =>
                      setLineDrafts((prev) => ({
                        ...prev,
                        [line.id]: { ...draft, release: e.target.value },
                      }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Fail</Label>
                  <Input
                    className="h-8"
                    value={draft.fail}
                    onChange={(e) =>
                      setLineDrafts((prev) => ({
                        ...prev,
                        [line.id]: { ...draft, fail: e.target.value },
                      }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Fail as</Label>
                  <Select
                    value={draft.disposition}
                    onValueChange={(value) =>
                      setLineDrafts((prev) => ({
                        ...prev,
                        [line.id]: { ...draft, disposition: value },
                      }))
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GRN_REJECT_DISPOSITIONS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="self-end"
                  disabled={isPending}
                  onClick={() => handleReleaseLine(line)}
                >
                  Apply
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <Button type="button" size="sm" disabled={isPending} onClick={handleReleaseAll}>
        {isPending ? "Releasing…" : "Release all from QC hold"}
      </Button>
    </section>
  );
}
