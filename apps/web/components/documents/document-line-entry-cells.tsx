"use client";

import { forwardRef } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const DOCUMENT_LINE_COMPACT_INPUT_CLASS =
  "h-8 w-full min-w-0 rounded-none border-0 bg-transparent px-2 text-sm shadow-none focus-visible:border-transparent focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0";

/** Spreadsheet cell embed — square corners, no inner border box. */
export const DOCUMENT_LINE_ITEM_CELL_INPUT_CLASS =
  "h-9 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:border-transparent focus-visible:outline-none focus-visible:shadow-none focus-visible:ring-0 focus-visible:ring-offset-0";

export const DocumentLineCompactInput = forwardRef<
  HTMLInputElement,
  React.ComponentProps<typeof Input> & {
    align?: "left" | "right" | "center";
  }
>(function DocumentLineCompactInput({ align, className, ...props }, ref) {
  return (
    <div className={align === "right" ? "flex justify-end" : undefined}>
      <Input
        ref={ref}
        className={cn(
          "tabular-nums",
          DOCUMENT_LINE_COMPACT_INPUT_CLASS,
          "w-full",
          align === "right" && "text-right",
          className
        )}
        {...props}
      />
    </div>
  );
});

export function DocumentLineRemoveButton({
  lineKey,
  disabled,
  canRemove,
  onRemove,
}: {
  lineKey: string;
  disabled: boolean;
  canRemove: boolean;
  onRemove: (key: string) => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 w-8 p-0 text-muted-foreground"
      disabled={disabled || !canRemove}
      onClick={() => onRemove(lineKey)}
      aria-label="Remove line"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}

export function DocumentLineReadOnlyItemCell({
  itemName,
  variantSku,
  hint,
}: {
  itemName: string;
  variantSku: string;
  hint?: string | null;
}) {
  return (
    <div className="min-w-0 px-2 py-2 text-sm">
      {variantSku ? (
        <div className="truncate font-mono text-xs leading-snug text-muted-foreground">
          {variantSku}
        </div>
      ) : null}
      <div className="truncate text-sm leading-snug">{itemName || "—"}</div>
      {hint ? (
        <div className="mt-1 truncate text-xs text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}

export function DocumentLineReadOnlyValueCell({
  value,
  align = "right",
}: {
  value: React.ReactNode;
  align?: "left" | "right" | "center";
}) {
  return (
    <div
      className={cn(
        "px-2 py-1.5 text-sm tabular-nums text-muted-foreground",
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
      )}
    >
      {value}
    </div>
  );
}
