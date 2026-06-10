"use client";

import { PO_LINE_SUBLINE_SELECT_CLASS } from "@/components/procurement/purchase-orders/po-line-qty-unit-slot";
import { cn } from "@/lib/utils";
import type { PoLineDiscountType } from "@/lib/procurement/purchase-orders/po-line-discount";

const PO_LINE_DISCOUNT_TYPE_TEXT_CLASS = "text-xs leading-tight text-foreground/80";

export type PoLineDiscountTypeSlotProps = {
  type: PoLineDiscountType;
  align?: "left" | "right" | "center";
  className?: string;
  disabled?: boolean;
  onTypeChange?: (type: PoLineDiscountType) => void;
};

/** Compact % | Amt selector stacked under the discount value (mirrors UOM under qty). */
export function PoLineDiscountTypeSlot({
  type,
  align = "right",
  className,
  disabled = false,
  onTypeChange,
}: PoLineDiscountTypeSlotProps) {
  return (
    <select
      value={type}
      disabled={disabled}
      aria-label="Discount type"
      onChange={(event) => onTypeChange?.(event.target.value as PoLineDiscountType)}
      className={cn(
        "h-4 w-full max-w-full cursor-pointer truncate px-2",
        PO_LINE_SUBLINE_SELECT_CLASS,
        PO_LINE_DISCOUNT_TYPE_TEXT_CLASS,
        align === "right" && "text-right",
        align === "center" && "text-center",
        className
      )}
    >
      <option value="percent">%</option>
      <option value="amount">Amt</option>
    </select>
  );
}
