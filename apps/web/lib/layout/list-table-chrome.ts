import { cn } from "@/lib/utils";

/** Shared table row / header tokens for list modules (Items-aligned hover + selection). */
export const LIST_TABLE_ROW_BASE =
  "group box-border border-b border-border transition-colors duration-200";

export const LIST_TABLE_ROW_HOVER =
  "hover:bg-[color-mix(in_srgb,hsl(var(--primary))_8%,hsl(var(--background)))] dark:hover:bg-[color-mix(in_srgb,hsl(var(--accent))_35%,hsl(var(--muted)))]";

export const LIST_TABLE_ROW_SELECTED =
  "bg-primary/5 ring-1 ring-inset ring-primary/20";

export const LIST_TABLE_ROW_SELECTED_HOVER =
  "hover:bg-[color-mix(in_srgb,hsl(var(--primary))_12%,hsl(var(--background)))] dark:hover:bg-[color-mix(in_srgb,hsl(var(--primary))_8%,hsl(var(--accent))_40%,hsl(var(--muted)))]";

export function listTableRowClass(selected: boolean, clickable = true): string {
  return cn(
    LIST_TABLE_ROW_BASE,
    clickable && "cursor-pointer",
    selected ? cn(LIST_TABLE_ROW_SELECTED, LIST_TABLE_ROW_SELECTED_HOVER) : LIST_TABLE_ROW_HOVER
  );
}

/** Outer list table frame — matches `.surface-inset` (rounded border on module lists). */
export const LIST_TABLE_SURFACE = "surface-inset h-full min-h-0 overflow-hidden";

export const LIST_TABLE_HEADER_ROW = "sticky top-0 z-10 bg-muted";

export const LIST_TABLE_HEADER_CELL_BG = "bg-muted";

export const LIST_TABLE_HEADER_CELL =
  "p-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground";

export const LIST_TABLE_HEADER_SORTABLE =
  "cursor-pointer select-none transition-colors hover:bg-[color-mix(in_srgb,hsl(var(--primary))_12%,hsl(var(--muted)))] dark:hover:bg-[color-mix(in_srgb,hsl(var(--accent))_40%,hsl(var(--muted)))]";

export const LIST_TABLE_BODY_CELL = "p-2.5";
