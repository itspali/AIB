"use client";

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
        "h-4 w-full max-w-full cursor-pointer truncate border-0 bg-transparent px-2 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50",
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
