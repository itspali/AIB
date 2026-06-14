"use client";

import { DocumentLineCompactInput } from "@/components/documents/document-line-entry-cells";
import { documentFieldTypographyClassName } from "@/lib/documents/document-typography-classes";
import type { DocumentColumnPref } from "@/lib/documents/types";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";
import { patchPoLineHsnSacCode } from "@/lib/procurement/purchase-orders/po-gst-compliance";
import { PO_LINE_SUBLINE_EDITABLE_INPUT_CLASS } from "@/components/procurement/purchase-orders/po-line-qty-unit-slot";
import { cn } from "@/lib/utils";

type Props = {
  line: PoDraftLine;
  column: DocumentColumnPref;
  disabled?: boolean;
  onPatch: (patch: Partial<PoDraftLine>) => void;
};

/** Editable HSN/SAC for GST-registered PO entry when catalog value is missing or overridden. */
export function PoLineHsnSacSlot({ line, column, disabled = false, onPatch }: Props) {
  const value = line.catalog_context?.hsn_sac_code ?? "";

  return (
    <div
      className={documentFieldTypographyClassName(
        column,
        cn("flex min-w-0 items-baseline gap-1 text-xs leading-snug text-muted-foreground")
      )}
    >
      {column.showLabel !== false ? (
        <span className="shrink-0">{column.label}:</span>
      ) : null}
      <DocumentLineCompactInput
        className={cn(
          PO_LINE_SUBLINE_EDITABLE_INPUT_CLASS,
          "!w-[5.5rem] font-mono",
          documentFieldTypographyClassName(column, ""),
          "text-foreground"
        )}
        value={value}
        disabled={disabled || !line.variant_id}
        inputMode="text"
        aria-label="HSN or SAC code"
        placeholder="Required"
        onChange={(event) => onPatch(patchPoLineHsnSacCode(line, event.target.value))}
        onBlur={(event) => onPatch(patchPoLineHsnSacCode(line, event.target.value.trim()))}
      />
    </div>
  );
}
