"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const PO_LINE_UNIT_ROW_CLASS = "h-4";
/** Shared typography for compact line sublines (UOM, MRP trade %, disc type). */
export const PO_LINE_SUBLINE_TEXT_CLASS = "text-xs leading-tight text-foreground/80";

/** Inset field styling so subline values read as editable, not static text. */
export const PO_LINE_SUBLINE_EDITABLE_INPUT_CLASS =
  "h-4 w-[3.25rem] shrink-0 cursor-text rounded-sm border border-border/60 bg-background px-1 py-0 text-xs leading-tight tabular-nums shadow-none transition-[background-color,border-color,box-shadow] hover:border-border hover:bg-accent/30 focus-visible:border-ring focus-visible:bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/45 disabled:cursor-not-allowed disabled:opacity-50";

const PO_LINE_UNIT_TEXT_CLASS = PO_LINE_SUBLINE_TEXT_CLASS;

export type PoLineQtyUnitSlotProps = {
  unitCode: string | null;
  align?: "left" | "right" | "center";
  className?: string;
  editable?: boolean;
  disabled?: boolean;
  unitOptions?: readonly string[];
  onUnitChange?: (unitCode: string) => void;
  /** Shown when purchase UOM differs from base (e.g. "(4 PCS)" or "1 BOX = 2 PCS"). */
  conversionHint?: string | null;
  /** When true, always reserves unit + hint rows so the qty cell height stays fixed. */
  reserveLayout?: boolean;
};

/** Fixed height for the unit + conversion stack under qty (less than the h-8 qty input). */
export const PO_LINE_QTY_UNIT_STACK_CLASS = "h-8 shrink-0";

/** Qty input row height — matches other compact line inputs. */
export const PO_LINE_QTY_INPUT_ROW_CLASS = "h-8 w-full shrink-0";

/** Divider between the primary value input and stacked sublines (UOM, MRP %, disc type). */
export const PO_LINE_QTY_VALUE_SUBLINE_SEPARATOR_CLASS =
  "border-t border-border pt-2 pb-0.5";

type PoLineQtyValueStackProps = {
  showUnitUnderQty: boolean;
  align?: "left" | "right" | "center";
  unitSlot?: ReactNode;
  children: ReactNode;
  className?: string;
  unitSlotClassName?: string;
};

/** Top-aligned qty with unit metadata stacked below (grows row height instead of overflowing). */
export function PoLineQtyValueStack({
  showUnitUnderQty,
  align,
  unitSlot,
  children,
  className,
  unitSlotClassName,
}: PoLineQtyValueStackProps) {
  if (!showUnitUnderQty) {
    return <>{children}</>;
  }

  return (
    <div className={cn("flex w-full flex-col px-1 py-0.5", className)}>
      <div className={PO_LINE_QTY_INPUT_ROW_CLASS}>{children}</div>
      <div
        className={cn(
          PO_LINE_QTY_VALUE_SUBLINE_SEPARATOR_CLASS,
          "w-full min-w-0 max-w-full shrink-0",
          unitSlotClassName,
          align === "right" && "flex justify-end"
        )}
      >
        {unitSlot}
      </div>
    </div>
  );
}

function rowAlignClass(align: PoLineQtyUnitSlotProps["align"]) {
  return align === "right"
    ? "justify-end text-right"
    : align === "center"
      ? "justify-center text-center"
      : undefined;
}

/**
 * Unit of measure slot stacked under the Qty input or in the standalone Unit column.
 */
export function PoLineQtyUnitSlot({
  unitCode,
  align = "right",
  className,
  editable = false,
  disabled = false,
  unitOptions,
  onUnitChange,
  conversionHint,
  reserveLayout = true,
}: PoLineQtyUnitSlotProps) {
  const options = unitOptions?.length ? unitOptions : unitCode ? [unitCode] : [];
  const showSelect = editable && options.length > 1 && unitCode;
  const hint = conversionHint?.trim() || null;
  const alignClass = rowAlignClass(align);

  const unitControl = showSelect ? (
    <select
      value={unitCode}
      disabled={disabled}
      aria-label="Unit of measure"
      onChange={(event) => onUnitChange?.(event.target.value)}
      className={cn(
        "h-4 w-full max-w-full cursor-pointer truncate border-0 bg-transparent px-2 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50",
        PO_LINE_UNIT_TEXT_CLASS,
        align === "right" && "text-right",
        align === "center" && "text-center"
      )}
    >
      {options.map((code) => (
        <option key={code} value={code}>
          {code}
        </option>
      ))}
    </select>
  ) : unitCode ? (
    <span
      className={cn(
        "block w-full max-w-full truncate px-2",
        PO_LINE_UNIT_TEXT_CLASS,
        align === "right" && "text-right",
        align === "center" && "text-center"
      )}
      title={unitCode}
      aria-label={`Unit ${unitCode}`}
    >
      {unitCode}
    </span>
  ) : null;

  if (!reserveLayout) {
    if (!unitCode && !hint) return null;
    return (
      <div className={cn("flex min-w-0 flex-col", align === "right" && "items-end", className)}>
        {unitControl}
        {hint ? (
          <span
            className={cn(
              "block max-w-full truncate px-2",
              PO_LINE_UNIT_TEXT_CLASS,
              align === "right" && "text-right",
              align === "center" && "text-center"
            )}
            title={hint}
          >
            {hint}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col",
        PO_LINE_QTY_UNIT_STACK_CLASS,
        align === "right" && "items-end",
        className
      )}
    >
      <div
        className={cn(
          "flex w-full min-w-0 items-center",
          PO_LINE_UNIT_ROW_CLASS,
          alignClass,
          !unitControl && "invisible"
        )}
      >
        {unitControl ?? <span className="px-2 text-xs">&nbsp;</span>}
      </div>
      <div
        className={cn(
          "flex w-full min-w-0 items-center truncate px-2",
          PO_LINE_UNIT_ROW_CLASS,
          PO_LINE_UNIT_TEXT_CLASS,
          alignClass,
          !hint && "invisible"
        )}
        title={hint ?? undefined}
        aria-hidden={!hint}
      >
        {hint ?? "\u00a0"}
      </div>
    </div>
  );
}
