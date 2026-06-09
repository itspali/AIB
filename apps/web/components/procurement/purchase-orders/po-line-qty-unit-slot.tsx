"use client";

import { cn } from "@/lib/utils";

export type PoLineQtyUnitSlotProps = {
  unitCode: string | null;
  align?: "left" | "right" | "center";
  className?: string;
  /** Phase 3 — alternate UOM select replaces the read-only label. */
  editable?: boolean;
  disabled?: boolean;
  unitOptions?: readonly string[];
  onUnitChange?: (unitCode: string) => void;
};

/**
 * Unit of measure slot stacked under the Qty input.
 * Phase 3: set `editable` and wire `onUnitChange` for line-level UOM selection.
 */
export function PoLineQtyUnitSlot({
  unitCode,
  align = "right",
  className,
  editable = false,
  disabled: _disabled = false,
  unitOptions: _unitOptions,
  onUnitChange: _onUnitChange,
}: PoLineQtyUnitSlotProps) {
  if (editable) {
    // Phase 3: render compact UOM Select when alternate_uoms are enabled on the line.
    return null;
  }

  if (!unitCode) return null;

  return (
    <span
      className={cn(
        "block max-w-full truncate px-2 text-[10px] leading-tight text-muted-foreground",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className
      )}
      title={unitCode}
      aria-label={`Unit ${unitCode}`}
    >
      {unitCode}
    </span>
  );
}
