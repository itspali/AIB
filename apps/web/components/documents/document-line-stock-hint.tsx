"use client";

import {
  PO_LINE_SUBLINE_TEXT_CLASS,
  PoLineSublineRow,
  PoLineSublineSingleRow,
  PoLineSublineZone,
} from "@/components/procurement/purchase-orders/po-line-qty-unit-slot";
import { formatDocumentDecimal } from "@/lib/documents/decimal-format";
import type { DocumentLineStockContext } from "@/lib/inventory/stock/line-stock-context";
import { cn } from "@/lib/utils";

type Props = {
  context: DocumentLineStockContext | null | undefined;
  className?: string;
  /** `qty-subline` aligns with compact line-grid sublines under Qty. */
  variant?: "item" | "qty-subline";
  align?: "left" | "right" | "center";
  /** Which balance to show in compact qty sublines (default: available). */
  sublineMetric?: "available" | "on_hand";
};

function formatCompactStockQuantity(raw: string): string {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return raw.trim() || "0";
  if (Math.abs(parsed - Math.round(parsed)) < 1e-9) {
    return formatDocumentDecimal(parsed, 0);
  }
  const trimmed = formatDocumentDecimal(parsed, 3).replace(/(\.\d*?)0+$/, "$1");
  return trimmed.endsWith(".") ? trimmed.slice(0, -1) : trimmed;
}

function sublineAlignClass(align: Props["align"]) {
  return align === "right"
    ? "text-right"
    : align === "center"
      ? "text-center"
      : "text-left";
}

function sublineTextClassName(
  align: Props["align"],
  tone: "muted" | "warning"
) {
  return cn(
    "block w-full truncate px-2 tabular-nums",
    PO_LINE_SUBLINE_TEXT_CLASS,
    sublineAlignClass(align),
    tone === "warning" ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"
  );
}

export function DocumentLineStockHint({
  context,
  className,
  variant = "item",
  align = "left",
  sublineMetric = "available",
}: Props) {
  if (!context) return null;

  const onHand = formatCompactStockQuantity(context.quantity_on_hand);
  const available = formatCompactStockQuantity(
    context.quantity_available ?? context.quantity_on_hand
  );
  const unit = context.base_unit_of_measure.trim();
  const fullLabel = unit
    ? `On hand: ${onHand} ${unit} · Available: ${available} ${unit}`
    : `On hand: ${onHand} · Available: ${available}`;

  if (variant === "qty-subline") {
    const sublineQuantity =
      sublineMetric === "on_hand" ? onHand : available;
    const sublinePrefix = sublineMetric === "on_hand" ? "On hand" : "Avail";

    if (context.below_reorder) {
      return (
        <PoLineSublineZone align={align} className={className}>
          <PoLineSublineRow align={align}>
            <span className={sublineTextClassName(align, "muted")} title={fullLabel}>
              {sublinePrefix} {sublineQuantity}
            </span>
          </PoLineSublineRow>
          <PoLineSublineRow align={align}>
            <span className={sublineTextClassName(align, "warning")} title="Below reorder">
              Below reorder
            </span>
          </PoLineSublineRow>
        </PoLineSublineZone>
      );
    }

    return (
      <PoLineSublineSingleRow align={align} className={className}>
        <span className={sublineTextClassName(align, "muted")} title={fullLabel}>
          {sublinePrefix} {sublineQuantity}
        </span>
      </PoLineSublineSingleRow>
    );
  }

  return (
    <p
      className={cn(
        "text-xs leading-snug tabular-nums",
        context.below_reorder
          ? "text-amber-700 dark:text-amber-300"
          : "text-muted-foreground",
        sublineAlignClass(align),
        className
      )}
      title={fullLabel + (context.below_reorder ? " · Below reorder" : "")}
    >
      {fullLabel}
      {context.below_reorder ? " · Below reorder" : null}
    </p>
  );
}
