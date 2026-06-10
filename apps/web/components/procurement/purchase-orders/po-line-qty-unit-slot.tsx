"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** One subline row — shared across qty, discount, tax, and line-total cells. */
export const PO_LINE_SUBLINE_ROW_CLASS =
  "flex h-4 w-full min-w-0 shrink-0 items-center";

/** Two-row subline block under the primary h-8 value (keeps columns aligned). */
export const PO_LINE_SUBLINE_ZONE_CLASS =
  "flex h-9 w-full min-w-0 shrink-0 flex-col gap-1";

const PO_LINE_UNIT_ROW_CLASS = PO_LINE_SUBLINE_ROW_CLASS;
/** Shared typography for compact line sublines (UOM, MRP trade %, disc type). */
export const PO_LINE_SUBLINE_TEXT_CLASS = "text-xs leading-tight text-foreground/80";

/** Borderless subline input — matches select sublines; ring on focus only. */
export const PO_LINE_SUBLINE_EDITABLE_INPUT_CLASS =
  "h-4 w-[3.25rem] shrink-0 cursor-text rounded-sm border-0 bg-transparent px-1 py-0 text-xs leading-tight tabular-nums shadow-none transition-[background-color,box-shadow] hover:bg-accent/30 focus-visible:bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/45 disabled:cursor-not-allowed disabled:opacity-50";

/** Shared focus/hover chrome for compact line-grid <select> sublines. */
export const PO_LINE_SUBLINE_SELECT_CLASS =
  "rounded-sm border border-transparent bg-transparent shadow-none transition-[background-color,border-color,box-shadow] hover:border-border/60 hover:bg-accent/30 focus:border-ring focus:bg-background focus:outline-none focus:ring-1 focus:ring-ring/45 disabled:cursor-not-allowed disabled:opacity-50";

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

/** @deprecated Use PO_LINE_SUBLINE_ZONE_CLASS */
export const PO_LINE_QTY_UNIT_STACK_CLASS = PO_LINE_SUBLINE_ZONE_CLASS;

/** Qty input row height — matches other compact line inputs. */
export const PO_LINE_QTY_INPUT_ROW_CLASS = "h-8 w-full shrink-0";

/** Divider between the primary value input and stacked sublines (UOM, MRP %, disc type). */
export const PO_LINE_QTY_VALUE_SUBLINE_SEPARATOR_CLASS =
  "border-t border-border pt-2 pb-0.5";

function rowAlignClass(align: PoLineQtyUnitSlotProps["align"] | undefined) {
  return align === "right"
    ? "justify-end text-right"
    : align === "center"
      ? "justify-center text-center"
      : undefined;
}

type PoLineSublineZoneProps = {
  align?: "left" | "right" | "center";
  children: ReactNode;
  className?: string;
};

/** Fixed-height subline stack (two h-4 rows + gap-1) shared by all line grid columns. */
export function PoLineSublineZone({ align, children, className }: PoLineSublineZoneProps) {
  return (
    <div
      className={cn(
        PO_LINE_SUBLINE_ZONE_CLASS,
        align === "right" && "items-end",
        align === "center" && "items-center",
        className
      )}
    >
      {children}
    </div>
  );
}

type PoLineSublineRowProps = {
  align?: "left" | "right" | "center";
  children?: ReactNode;
  className?: string;
  /** Reserve row height when empty so sibling columns stay aligned. */
  reserve?: boolean;
};

export function PoLineSublineRow({
  align,
  children,
  className,
  reserve = false,
}: PoLineSublineRowProps) {
  const empty = children == null || children === false;
  if (empty && !reserve) return null;

  return (
    <div
      className={cn(
        PO_LINE_SUBLINE_ROW_CLASS,
        rowAlignClass(align),
        empty && reserve && "invisible",
        className
      )}
    >
      {empty ? <span className="px-2 text-xs">&nbsp;</span> : children}
    </div>
  );
}

/** Single visible subline with a reserved second row for cross-column alignment. */
export function PoLineSublineSingleRow({
  align,
  children,
  className,
}: {
  align?: "left" | "right" | "center";
  children: ReactNode;
  className?: string;
}) {
  return (
    <PoLineSublineZone align={align} className={className}>
      <PoLineSublineRow align={align}>{children}</PoLineSublineRow>
      <PoLineSublineRow align={align} reserve />
    </PoLineSublineZone>
  );
}

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
          unitSlotClassName
        )}
      >
        {unitSlot}
      </div>
    </div>
  );
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

  const unitControl = showSelect ? (
    <select
      value={unitCode}
      disabled={disabled}
      aria-label="Unit of measure"
      onChange={(event) => onUnitChange?.(event.target.value)}
      className={cn(
        "h-4 w-full max-w-full cursor-pointer truncate px-2",
        PO_LINE_SUBLINE_SELECT_CLASS,
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
    <PoLineSublineZone align={align} className={className}>
      <PoLineSublineRow align={align} reserve={reserveLayout && !unitControl}>
        {unitControl}
      </PoLineSublineRow>
      <PoLineSublineRow align={align} reserve={reserveLayout && !hint}>
        {hint ? (
          <span
            className={cn(
              "block w-full truncate px-2",
              PO_LINE_UNIT_TEXT_CLASS,
              align === "right" && "text-right",
              align === "center" && "text-center"
            )}
            title={hint}
          >
            {hint}
          </span>
        ) : null}
      </PoLineSublineRow>
    </PoLineSublineZone>
  );
}
