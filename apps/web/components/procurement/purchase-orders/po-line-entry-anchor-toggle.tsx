"use client";

import { ArrowDownToLine, ArrowUpToLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PO_LINE_ENTRY_ANCHOR_LABEL,
  type PoLineEntryAnchor,
} from "@/lib/procurement/purchase-orders/line-entry-anchor";
import { cn } from "@/lib/utils";

type Props = {
  value: PoLineEntryAnchor;
  disabled?: boolean;
  onChange: (anchor: PoLineEntryAnchor) => void;
};

function segmentButtonClass(selected: boolean): string {
  return cn(
    "h-7 gap-1.5 px-2.5 text-xs font-medium",
    selected
      ? "bg-background text-foreground shadow-sm"
      : "text-muted-foreground hover:text-foreground"
  );
}

export function PoLineEntryAnchorToggle({ value, disabled, onChange }: Props) {
  return (
    <div
      className="inline-flex shrink-0 gap-px rounded-md border border-border bg-muted p-px"
      role="group"
      aria-label="New line position"
    >
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className={segmentButtonClass(value === "bottom")}
        disabled={disabled}
        aria-pressed={value === "bottom"}
        onClick={() => onChange("bottom")}
      >
        <ArrowDownToLine className="h-3.5 w-3.5" aria-hidden />
        {PO_LINE_ENTRY_ANCHOR_LABEL.bottom}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className={segmentButtonClass(value === "top")}
        disabled={disabled}
        aria-pressed={value === "top"}
        onClick={() => onChange("top")}
      >
        <ArrowUpToLine className="h-3.5 w-3.5" aria-hidden />
        {PO_LINE_ENTRY_ANCHOR_LABEL.top}
      </Button>
    </div>
  );
}
