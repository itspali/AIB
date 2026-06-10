"use client";

import { DocumentLineCompactInput } from "@/components/documents/document-line-entry-cells";
import { documentFieldTypographyClassName } from "@/lib/documents/document-typography-classes";
import { normalizeDocumentDecimalInput } from "@/lib/documents/decimal-format";
import type { DocumentColumnPref } from "@/lib/documents/types";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";
import {
  formatPoLineMrpReference,
  resolvePoLineMrp,
  resolvePoLineMrpMarkdownPercentage,
} from "@/lib/procurement/purchase-orders/po-line-mrp-markdown";
import {
  PO_LINE_SUBLINE_EDITABLE_INPUT_CLASS,
  PO_LINE_SUBLINE_TEXT_CLASS,
} from "@/components/procurement/purchase-orders/po-line-qty-unit-slot";
import { cn } from "@/lib/utils";

type Props = {
  line: PoDraftLine;
  column: DocumentColumnPref;
  disabled?: boolean;
  /** When MRP is already a table column, hide the duplicate reference line here. */
  showMrpReference?: boolean;
  onMarkdownChange: (markdownPct: string) => void;
  onMarkdownBlur?: (markdownPct: string) => void;
};

/** Compact trade markdown control stacked under offer unit price (cell-contained). */
export function PoLineMrpMarkdownSlot({
  line,
  column,
  disabled = false,
  showMrpReference = true,
  onMarkdownChange,
  onMarkdownBlur,
}: Props) {
  const mrp = resolvePoLineMrp(line);
  if (mrp <= 0) return null;

  const markdownValue = resolvePoLineMrpMarkdownPercentage(line);

  return (
    <div
      className={cn(
        "w-full min-w-0 max-w-full",
        PO_LINE_SUBLINE_TEXT_CLASS,
        column.align === "right" && "text-right"
      )}
    >
      <div
        role="group"
        aria-label="Percent off MRP"
        className={cn(
          "inline-flex max-w-full items-center gap-0.5",
          column.align === "right" ? "ml-auto" : "mr-auto"
        )}
      >
        <DocumentLineCompactInput
          align={column.align}
          className={cn(
            PO_LINE_SUBLINE_EDITABLE_INPUT_CLASS,
            documentFieldTypographyClassName(column),
            column.align === "right" && "text-right"
          )}
          value={markdownValue}
          disabled={disabled}
          inputMode="decimal"
          title="Edit percent off MRP"
          onChange={(event) => onMarkdownChange(event.target.value)}
          onBlur={(event) => {
            if (onMarkdownBlur) {
              onMarkdownBlur(event.target.value);
              return;
            }
            const normalized = normalizeDocumentDecimalInput(event.target.value, 2);
            if (normalized !== event.target.value) {
              onMarkdownChange(normalized);
            }
          }}
        />
        <span className="shrink-0 select-none">%</span>
        <span className="shrink-0 select-none">Off</span>
      </div>
      {showMrpReference ? (
        <p className="mt-0.5 truncate tabular-nums">
          MRP {formatPoLineMrpReference(mrp, 2)}
        </p>
      ) : null}
    </div>
  );
}
