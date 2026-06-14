"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  PO_PRICES_TAX_MODE_LABEL,
  PO_PRICES_TAX_MODE_SHORT_LABEL,
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

const PO_PRICES_TAX_MODE_OPTIONS: PoPricesTaxMode[] = ["exclusive", "inclusive"];

const triggerClassName =
  "h-8 min-w-0 w-auto shrink-0 gap-1 px-1.5 text-xs font-medium sm:gap-1.5 sm:px-2.5 [&>svg]:h-3.5 [&>svg]:w-3.5 sm:[&>svg]:h-4 sm:[&>svg]:w-4";

export function PoLineTaxModeToggle({ value, disabled, onChange }: Props) {
  const mode = poPricesTaxInclusiveToMode(value);

  return (
    <Select
      value={mode}
      disabled={disabled}
      onValueChange={(next) => onChange(poPricesTaxModeToInclusive(next as PoPricesTaxMode))}
    >
      <SelectTrigger className={triggerClassName} aria-label="Unit price tax treatment">
        <span className={cn("truncate", "sm:hidden")}>{PO_PRICES_TAX_MODE_SHORT_LABEL[mode]}</span>
        <span className={cn("truncate", "hidden sm:inline")}>{PO_PRICES_TAX_MODE_LABEL[mode]}</span>
      </SelectTrigger>
      <SelectContent align="end">
        {PO_PRICES_TAX_MODE_OPTIONS.map((option) => (
          <SelectItem key={option} value={option} className="text-xs">
            {PO_PRICES_TAX_MODE_LABEL[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
