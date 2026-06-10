"use client";

import { Button } from "@/components/ui/button";
import {
  PO_PRICES_TAX_MODE_LABEL,
  poPricesTaxInclusiveToMode,
  poPricesTaxModeToInclusive,
  type PoPricesTaxMode,
} from "@/lib/procurement/purchase-orders/po-line-tax-mode";
import { cn } from "@/lib/utils";

type Props = {
  value: boolean;
  disabled?: boolean;
  onChange: (pricesTaxInclusive: boolean) => void;
};

function segmentButtonClass(selected: boolean): string {
  return cn(
    "h-7 gap-1.5 px-2.5 text-xs font-medium",
    selected
      ? "bg-background text-foreground shadow-sm"
      : "text-muted-foreground hover:text-foreground"
  );
}

export function PoLineTaxModeToggle({ value, disabled, onChange }: Props) {
  const mode = poPricesTaxInclusiveToMode(value);

  const setMode = (next: PoPricesTaxMode) => {
    onChange(poPricesTaxModeToInclusive(next));
  };

  return (
    <div
      className="inline-flex shrink-0 gap-px rounded-md border border-border bg-muted p-px"
      role="group"
      aria-label="Unit price tax treatment"
    >
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className={segmentButtonClass(mode === "exclusive")}
        disabled={disabled}
        aria-pressed={mode === "exclusive"}
        onClick={() => setMode("exclusive")}
      >
        {PO_PRICES_TAX_MODE_LABEL.exclusive}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className={segmentButtonClass(mode === "inclusive")}
        disabled={disabled}
        aria-pressed={mode === "inclusive"}
        onClick={() => setMode("inclusive")}
      >
        {PO_PRICES_TAX_MODE_LABEL.inclusive}
      </Button>
    </div>
  );
}
