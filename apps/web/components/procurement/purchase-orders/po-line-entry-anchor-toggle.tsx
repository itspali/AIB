"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  PO_LINE_ENTRY_ANCHOR_LABEL,
  PO_LINE_ENTRY_ANCHOR_SHORT_LABEL,
  type PoLineEntryAnchor,
} from "@/lib/procurement/purchase-orders/line-entry-anchor";
import { cn } from "@/lib/utils";

type Props = {
  value: PoLineEntryAnchor;
  disabled?: boolean;
  onChange: (anchor: PoLineEntryAnchor) => void;
};

const PO_LINE_ENTRY_ANCHOR_OPTIONS: PoLineEntryAnchor[] = ["bottom", "top"];

const triggerClassName =
  "h-8 min-w-0 w-auto shrink-0 gap-1 px-1.5 text-xs font-medium sm:gap-1.5 sm:px-2.5 [&>svg]:h-3.5 [&>svg]:w-3.5 sm:[&>svg]:h-4 sm:[&>svg]:w-4";

export function PoLineEntryAnchorToggle({ value, disabled, onChange }: Props) {
  return (
    <Select value={value} disabled={disabled} onValueChange={(next) => onChange(next as PoLineEntryAnchor)}>
      <SelectTrigger className={triggerClassName} aria-label="New line position">
        <span className={cn("truncate", "sm:hidden")}>{PO_LINE_ENTRY_ANCHOR_SHORT_LABEL[value]}</span>
        <span className={cn("truncate", "hidden sm:inline")}>{PO_LINE_ENTRY_ANCHOR_LABEL[value]}</span>
      </SelectTrigger>
      <SelectContent align="end">
        {PO_LINE_ENTRY_ANCHOR_OPTIONS.map((option) => (
          <SelectItem key={option} value={option} className="text-xs">
            {PO_LINE_ENTRY_ANCHOR_LABEL[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
