"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { DocumentLineCompactInput } from "@/components/documents/document-line-entry-cells";
import { normalizeDocumentDecimalInput } from "@/lib/documents/decimal-format";
import type { DocumentColumnPref } from "@/lib/documents/types";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";
import {
  resolvePoLineMrp,
  resolvePoLineMrpMarkdownPercentage,
  resolvePoLineMrpTaxContext,
  resolvePoLineMrpVarianceDirection,
  type PoLineMrpVarianceDirection,
} from "@/lib/procurement/purchase-orders/po-line-mrp-markdown";
import { PoLineMrpReferenceSlot } from "@/components/procurement/purchase-orders/po-line-mrp-reference-slot";
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
  pricesTaxInclusive?: boolean;
  /**
   * hidden — MRP lives in its own column (or not shown here).
   * editable — PO MRP input (defaults from catalog; override for this order).
   */
  mrpDisplayMode?: "hidden" | "editable";
  onMrpReferenceChange?: (mrpReference: string) => void;
  onMrpReferenceBlur?: (mrpReference: string) => void;
  onMarkdownChange: (markdownPct: string) => void;
  onMarkdownBlur?: (markdownPct: string) => void;
};

function parseUnitPrice(value: string | undefined): number {
  const parsed = Number((value ?? "").trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

/** Single variance chevron — solid pill above MRP (red), below MRP (green). */
export function PoLineMrpVarianceArrow({
  direction,
  className,
}: {
  direction: PoLineMrpVarianceDirection | null;
  className?: string;
}) {
  if (!direction) return null;

  const isAbove = direction === "above";
  const Icon = isAbove ? ChevronUp : ChevronDown;

  return (
    <span
      className={cn(
        "inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full shadow-sm",
        isAbove
          ? "bg-destructive text-destructive-foreground"
          : "bg-emerald-600 text-white dark:bg-emerald-500",
        className
      )}
      aria-hidden
    >
      <Icon className="h-2.5 w-2.5" strokeWidth={3} />
    </span>
  );
}

/** Compact trade markdown control stacked under offer unit price (cell-contained). */
export function PoLineMrpMarkdownSlot({
  line,
  column,
  disabled = false,
  pricesTaxInclusive = false,
  mrpDisplayMode = "editable",
  onMrpReferenceChange,
  onMrpReferenceBlur,
  onMarkdownChange,
  onMarkdownBlur,
}: Props) {
  const mrp = resolvePoLineMrp(line);
  if (mrp <= 0 && mrpDisplayMode !== "editable") return null;

  const mrpTaxContext = resolvePoLineMrpTaxContext(line, pricesTaxInclusive);
  const markdownValue =
    mrp > 0 ? resolvePoLineMrpMarkdownPercentage(line, pricesTaxInclusive) : "0";
  const markdownDisabled = disabled || mrp <= 0;
  const varianceDirection =
    mrp > 0
      ? resolvePoLineMrpVarianceDirection(
          mrp,
          parseUnitPrice(line.unit_price_contractual),
          mrpTaxContext
        )
      : null;
  const showMrpRow = mrpDisplayMode !== "hidden";

  return (
    <PoLineSublineZone align={column.align}>
      <PoLineSublineRow align={column.align}>
        <div
          role="group"
          aria-label="Percent variance from MRP"
          className={cn(
            "flex w-full min-w-0 items-center gap-1 px-2",
            PO_LINE_SUBLINE_TEXT_CLASS,
            column.align === "right" && "justify-end text-right",
            column.align === "center" && "justify-center text-center"
          )}
        >
          <DocumentLineCompactInput
            className={cn(
              PO_LINE_SUBLINE_EDITABLE_INPUT_CLASS,
              "!w-[3.75rem]",
              column.align === "right" && "text-right"
            )}
            value={markdownValue}
            disabled={markdownDisabled}
            inputMode="decimal"
            title={mrp > 0 ? "Edit percent variance from MRP" : "Enter MRP first"}
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
          <PoLineMrpVarianceArrow direction={varianceDirection} />
        </div>
      </PoLineSublineRow>
      <PoLineSublineRow align={column.align} reserve={!showMrpRow}>
        {mrpDisplayMode === "editable" && onMrpReferenceChange ? (
          <div
            className={cn(
              "flex w-full min-w-0 items-center gap-1 px-2",
              PO_LINE_SUBLINE_TEXT_CLASS,
              column.align === "right" && "justify-end text-right",
              column.align === "center" && "justify-center text-center"
            )}
          >
            <span className="shrink-0 text-muted-foreground">MRP</span>
            <PoLineMrpReferenceSlot
              line={line}
              column={column}
              disabled={disabled}
              layout="inline"
              onChange={onMrpReferenceChange}
              onBlur={onMrpReferenceBlur}
            />
          </div>
        ) : null}
      </PoLineSublineRow>
    </PoLineSublineZone>
  );
}
