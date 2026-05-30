"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { BulkPricingAdjustmentMode, BulkPricingTarget } from "@/lib/products/bulk-schemas";

export type BulkPricingSubmitPayload = {
  target: BulkPricingTarget;
  mode: BulkPricingAdjustmentMode;
  value: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  isPending: boolean;
  canAdjustSelling: boolean;
  canAdjustPurchase: boolean;
  onSubmit: (payload: BulkPricingSubmitPayload) => void;
};

function defaultTarget(canAdjustSelling: boolean, canAdjustPurchase: boolean): BulkPricingTarget {
  if (canAdjustSelling && canAdjustPurchase) return "BOTH";
  if (canAdjustPurchase) return "PURCHASE";
  return "SELLING";
}

export function ProductBulkPricingDialog({
  open,
  onOpenChange,
  selectedCount,
  isPending,
  canAdjustSelling,
  canAdjustPurchase,
  onSubmit,
}: Props) {
  const [target, setTarget] = useState<BulkPricingTarget>(() =>
    defaultTarget(canAdjustSelling, canAdjustPurchase)
  );
  const [mode, setMode] = useState<BulkPricingAdjustmentMode>("PERCENTAGE");
  const [value, setValue] = useState("");

  const showTargetSelector = canAdjustSelling && canAdjustPurchase;

  useEffect(() => {
    if (!open) return;
    setTarget(defaultTarget(canAdjustSelling, canAdjustPurchase));
  }, [canAdjustPurchase, canAdjustSelling, open]);

  const handleOpenChange = (next: boolean) => {
    if (!next && !isPending) {
      setTarget(defaultTarget(canAdjustSelling, canAdjustPurchase));
      setMode("PERCENTAGE");
      setValue("");
    }
    onOpenChange(next);
  };

  const description =
    target === "BOTH"
      ? `Apply the same adjustment to selling prices and preferred supplier purchase rates for ${selectedCount} selected item master${selectedCount === 1 ? "" : "s"}. Items without a current price or supplier rate start from zero.`
      : target === "PURCHASE"
        ? `Apply a purchase cost change to ${selectedCount} selected item master${selectedCount === 1 ? "" : "s"}. Items without a preferred supplier rate are skipped.`
        : `Apply a selling price change to ${selectedCount} selected item master${selectedCount === 1 ? "" : "s"}. Items without a current price start from zero.`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mass pricing adjustment</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {showTargetSelector ? (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Apply to</Label>
              <RadioGroup
                value={target}
                onValueChange={(next) => setTarget(next as BulkPricingTarget)}
                className="gap-3"
              >
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <RadioGroupItem value="SELLING" id="bulk-pricing-target-selling" />
                  <span>Selling price only</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <RadioGroupItem value="PURCHASE" id="bulk-pricing-target-purchase" />
                  <span>Purchase cost only</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <RadioGroupItem value="BOTH" id="bulk-pricing-target-both" />
                  <span>Selling price and purchase cost</span>
                </label>
              </RadioGroup>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Adjustment type</Label>
            <RadioGroup
              value={mode}
              onValueChange={(next) => setMode(next as BulkPricingAdjustmentMode)}
              className="gap-3"
            >
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value="PERCENTAGE" id="bulk-pricing-percentage" />
                <span>Scale by Percentage %</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <RadioGroupItem value="FIXED_OFFSET" id="bulk-pricing-offset" />
                <span>Offset by Fixed Currency Value $</span>
              </label>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-pricing-value" className="text-sm font-medium text-muted-foreground">
              {mode === "PERCENTAGE" ? "Percentage change" : "Fixed currency offset"}
            </Label>
            <Input
              id="bulk-pricing-value"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className="text-right font-mono"
              inputMode="decimal"
              placeholder={mode === "PERCENTAGE" ? "e.g. 10" : "e.g. 5.00"}
              disabled={isPending}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            disabled={isPending || !value.trim()}
            onClick={() => onSubmit({ target, mode, value: value.trim() })}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Apply adjustment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
