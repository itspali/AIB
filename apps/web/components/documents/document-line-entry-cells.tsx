"use client";

import { forwardRef } from "react";
import { Copy, GripVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const DOCUMENT_LINE_COMPACT_INPUT_CLASS =
  "h-8 w-full min-w-0 rounded-none border-0 bg-transparent px-2 text-sm shadow-none focus-visible:border-transparent focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0";

/** Read-only primary line amount — same foreground as compact editable inputs. */
export const DOCUMENT_LINE_PRIMARY_AMOUNT_CLASS =
  "px-2 py-1.5 text-sm tabular-nums";

/** Primary amount row inside PoLineQtyValueStack (matches h-8 input row). */
export const DOCUMENT_LINE_PRIMARY_AMOUNT_STACK_CLASS =
  "block h-8 px-2 text-sm leading-8 tabular-nums";

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

export function DocumentLineDragHandle({
  lineKey,
  disabled,
  canDrag,
  label = "Drag to reorder line",
  onDragStart,
  onDragEnd,
}: {
  lineKey: string;
  disabled: boolean;
  canDrag: boolean;
  label?: string;
  onDragStart?: (event: React.DragEvent<HTMLButtonElement>) => void;
  onDragEnd?: () => void;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      draggable={canDrag && !disabled}
      disabled={disabled || !canDrag}
      aria-label={label}
      className={cn(
        "rounded p-0.5 text-muted-foreground",
        canDrag && !disabled
          ? "cursor-grab hover:bg-muted/60 active:cursor-grabbing"
          : "cursor-not-allowed opacity-40"
      )}
      onDragStart={(event) => {
        if (!canDrag || disabled) return;
        event.dataTransfer.setData("text/plain", lineKey);
        event.dataTransfer.effectAllowed = "move";
        onDragStart?.(event);
      }}
      onDragEnd={() => {
        onDragEnd?.();
      }}
    >
      <GripVertical className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}

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

export function DocumentLineDuplicateButton({
  lineKey,
  disabled,
  canDuplicate,
  onDuplicate,
}: {
  lineKey: string;
  disabled: boolean;
  canDuplicate: boolean;
  onDuplicate: (key: string) => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 w-8 p-0 text-muted-foreground"
      disabled={disabled || !canDuplicate}
      onClick={() => onDuplicate(lineKey)}
      aria-label="Duplicate line"
    >
      <Copy className="h-4 w-4" />
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
    <div className="min-w-0 max-w-full px-2 py-2 text-sm">
      {variantSku ? (
        <div className="break-words font-mono text-xs leading-snug text-muted-foreground">
          {variantSku}
        </div>
      ) : null}
      <div className="break-words text-sm leading-snug">{itemName || "—"}</div>
      {hint ? (
        <div className="mt-1 break-words text-xs text-muted-foreground">{hint}</div>
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
        DOCUMENT_LINE_PRIMARY_AMOUNT_CLASS,
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
      )}
    >
      {value}
    </div>
  );
}
