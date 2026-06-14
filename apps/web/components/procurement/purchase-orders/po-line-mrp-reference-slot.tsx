"use client";

import {
  DOCUMENT_LINE_COMPACT_INPUT_CLASS,
  DocumentLineCompactInput,
} from "@/components/documents/document-line-entry-cells";
import { documentFieldTypographyClassName } from "@/lib/documents/document-typography-classes";
import {
  normalizeDocumentDecimalInput,
  resolveColumnDecimalPlaces,
} from "@/lib/documents/decimal-format";
import type { DocumentColumnPref } from "@/lib/documents/types";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";
import {
  formatPoLineMrpReference,
  hasPoLineMrpOverride,
  resolvePoLineMrpFromCatalog,
  resolvePoLineMrpReferenceDisplay,
  syncPoLineMrpMarkdownFromOfferPrice,
} from "@/lib/procurement/purchase-orders/po-line-mrp-markdown";
import {
  PO_LINE_SUBLINE_EDITABLE_INPUT_CLASS,
  PO_LINE_SUBLINE_TEXT_CLASS,
  PoLineSublineRow,
  PoLineSublineZone,
} from "@/components/procurement/purchase-orders/po-line-qty-unit-slot";
import { cn } from "@/lib/utils";

type Props = {
  line: PoDraftLine;
  column: DocumentColumnPref;
  disabled?: boolean;
  /** Full column cell, compact subline under unit price, or bare input for embedding. */
  layout?: "subline" | "column" | "inline";
  onChange: (mrpReference: string) => void;
  onBlur?: (mrpReference: string) => void;
};

/** Editable PO MRP — defaults from catalog; override writes back on save when changed. */
export function PoLineMrpReferenceSlot({
  line,
  column,
  disabled = false,
  layout = "subline",
  onChange,
  onBlur,
}: Props) {
  if (!line.variant_id) return null;

  const decimalPlaces = resolveColumnDecimalPlaces(column);
  const catalogMrp = resolvePoLineMrpFromCatalog(line);
  const value = resolvePoLineMrpReferenceDisplay(line, decimalPlaces);
  const overridden = hasPoLineMrpOverride(line);
  const title =
    catalogMrp > 0
      ? overridden
        ? `Catalog MRP ${formatPoLineMrpReference(catalogMrp, decimalPlaces)} — overridden for this order`
        : `Catalog MRP ${formatPoLineMrpReference(catalogMrp, decimalPlaces)} — edit to override for this order`
      : "Reference MRP for this order";

  const input = (
    <DocumentLineCompactInput
      className={cn(
        layout === "column"
          ? cn(
              documentFieldTypographyClassName(column, DOCUMENT_LINE_COMPACT_INPUT_CLASS),
              column.align === "right" && "text-right"
            )
          : cn(
              PO_LINE_SUBLINE_EDITABLE_INPUT_CLASS,
              "!w-[5.5rem]",
              documentFieldTypographyClassName(column),
              column.align === "right" && "text-right"
            )
      )}
      align={column.align}
      value={value}
      disabled={disabled}
      inputMode="decimal"
      title={title}
      placeholder="0.00"
      onChange={(event) => onChange(event.target.value)}
      onBlur={(event) => {
        const normalized = normalizeDocumentDecimalInput(event.target.value, decimalPlaces);
        if (onBlur) {
          onBlur(normalized);
          return;
        }
        if (normalized !== event.target.value) onChange(normalized);
      }}
    />
  );

  if (layout === "column" || layout === "inline") {
    return input;
  }

  return (
    <PoLineSublineZone align={column.align}>
      <PoLineSublineRow align={column.align}>
        <div
          className={cn(
            "flex w-full min-w-0 items-center gap-1 px-2",
            PO_LINE_SUBLINE_TEXT_CLASS,
            column.align === "right" && "justify-end text-right",
            column.align === "center" && "justify-center text-center"
          )}
        >
          <span className="shrink-0 text-muted-foreground">MRP</span>
          {input}
        </div>
      </PoLineSublineRow>
    </PoLineSublineZone>
  );
}

export function patchPoLineMrpReference(
  line: PoDraftLine,
  mrpReferenceRaw: string,
  column?: DocumentColumnPref,
  pricesTaxInclusive = false
): Partial<PoDraftLine> {
  const decimalPlaces = column ? resolveColumnDecimalPlaces(column) : 2;
  const normalized = mrpReferenceRaw.trim()
    ? normalizeDocumentDecimalInput(mrpReferenceRaw, decimalPlaces)
    : "";
  const catalogMrp = resolvePoLineMrpFromCatalog(line);
  const catalogFormatted =
    catalogMrp > 0 ? formatPoLineMrpReference(catalogMrp, decimalPlaces) : null;

  let mrp_reference: string | null = normalized || null;
  if (!mrp_reference || mrp_reference === "0") {
    mrp_reference = null;
  } else if (catalogFormatted && mrp_reference === catalogFormatted) {
    mrp_reference = null;
  }

  const next: PoDraftLine = {
    ...line,
    mrp_reference,
  };
  const sync = syncPoLineMrpMarkdownFromOfferPrice(next, pricesTaxInclusive);
  return sync ? { mrp_reference, ...sync } : { mrp_reference };
}

/** Live draft while typing — keeps raw input without normalizing or clearing to catalog. */
export function patchPoLineMrpReferenceDraft(
  line: PoDraftLine,
  mrpReferenceRaw: string,
  pricesTaxInclusive = false
): Partial<PoDraftLine> {
  const next: PoDraftLine = {
    ...line,
    mrp_reference: mrpReferenceRaw,
  };
  const sync = syncPoLineMrpMarkdownFromOfferPrice(next, pricesTaxInclusive);
  return sync
    ? { mrp_reference: mrpReferenceRaw, ...sync }
    : { mrp_reference: mrpReferenceRaw };
}
