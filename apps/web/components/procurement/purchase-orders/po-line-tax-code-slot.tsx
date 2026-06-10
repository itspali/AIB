"use client";

import { useMemo } from "react";
import {
  itemTaxCodePickerLabel,
  resolveItemTaxCodePickerOptions,
} from "@/lib/tax/item-tax-code-picker";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";
import type { PoLineTaxCodeOption } from "@/lib/procurement/purchase-orders/po-line-tax-codes";
import {
  PO_LINE_SUBLINE_SELECT_CLASS,
  PO_LINE_SUBLINE_TEXT_CLASS,
} from "@/components/procurement/purchase-orders/po-line-qty-unit-slot";
import { cn } from "@/lib/utils";

export type PoLineTaxCodeSlotProps = {
  line: PoDraftLine;
  taxCodeOptions: readonly PoLineTaxCodeOption[];
  align?: "left" | "right" | "center";
  compact?: boolean;
  className?: string;
  disabled?: boolean;
  onTaxCodeChange?: (taxCodeId: string) => void;
};

/** Compact tax rule selector for PO line tax % cells. */
export function PoLineTaxCodeSlot({
  line,
  taxCodeOptions,
  align = "right",
  compact = false,
  className,
  disabled = false,
  onTaxCodeChange,
}: PoLineTaxCodeSlotProps) {
  const selectedId = line.catalog_context?.tax_code_id ?? "";
  const pickerOptions = useMemo(
    () =>
      resolveItemTaxCodePickerOptions(taxCodeOptions, {
        includeTaxCodeId: selectedId || null,
      }),
    [taxCodeOptions, selectedId]
  );

  const selectedKnown = pickerOptions.some((entry) => entry.id === selectedId);

  return (
    <select
      value={selectedId}
      disabled={disabled || pickerOptions.length === 0}
      aria-label="Tax rule"
      onChange={(event) => onTaxCodeChange?.(event.target.value)}
      className={cn(
        compact ? "h-4 w-full" : "h-8 w-full",
        "max-w-full cursor-pointer truncate px-2",
        PO_LINE_SUBLINE_SELECT_CLASS,
        compact ? PO_LINE_SUBLINE_TEXT_CLASS : "text-sm",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className
      )}
    >
      {!selectedId ? <option value="">Select tax</option> : null}
      {selectedId && !selectedKnown && line.catalog_context ? (
        <option value={selectedId}>
          {itemTaxCodePickerLabel({
            name: "Current tax",
            rate: line.catalog_context.tax_rate,
            kind: "GST",
            is_variable: line.catalog_context.tax_is_variable,
          })}
        </option>
      ) : null}
      {pickerOptions.map((code) => (
        <option key={code.id} value={code.id}>
          {code.pickerLabel}
        </option>
      ))}
    </select>
  );
}
