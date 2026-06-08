import { cn } from "@/lib/utils";

/** Resting row divider — always on body cells. */
export const LIST_TABLE_ROW_DIVIDER = "box-border border-b border-border";

export const LIST_TABLE_ROW_BASE =
  "group box-border transition-colors duration-100 ease-out";

/** Selected row outline — subtle border ring, not primary tint. */
export const LIST_TABLE_ROW_SELECTED = "ring-1 ring-inset ring-border/70 dark:ring-border/55";

/** Visible bottom edge (contrast bump over resting `border-border`). */
export const LIST_TABLE_CELL_STRONG_BOTTOM =
  "!border-b-[color-mix(in_srgb,hsl(var(--foreground))_10%,hsl(var(--border)))]";

/** Shared active fill (hover + selected) — darker muted family. */
export const LIST_TABLE_CELL_ACTIVE_FILL =
  "bg-[color-mix(in_srgb,hsl(var(--border))_12%,hsl(var(--muted)))] dark:bg-[color-mix(in_srgb,hsl(var(--background))_18%,hsl(var(--muted)))]";

/** Shared active top border (hover + selected). */
export const LIST_TABLE_CELL_ACTIVE_TOP =
  "border-t-[color-mix(in_srgb,hsl(var(--foreground))_7%,hsl(var(--border)))]";

/** Hover fill — same as selected resting fill. */
export const LIST_TABLE_CELL_HOVER_BG =
  "group-hover:bg-[color-mix(in_srgb,hsl(var(--border))_12%,hsl(var(--muted)))] dark:group-hover:bg-[color-mix(in_srgb,hsl(var(--background))_18%,hsl(var(--muted)))]";

/** Top + bottom borders on hover. */
export const LIST_TABLE_CELL_HOVER_EDGE =
  "group-hover:border-t group-hover:border-t-[color-mix(in_srgb,hsl(var(--foreground))_7%,hsl(var(--border)))] group-hover:!border-b-[color-mix(in_srgb,hsl(var(--foreground))_10%,hsl(var(--border)))]";

/** Selected row — same band as hover (not primary/blue). */
export const LIST_TABLE_CELL_SELECTED = LIST_TABLE_CELL_ACTIVE_FILL;

export const LIST_TABLE_CELL_SELECTED_EDGE = cn(
  "border-t",
  LIST_TABLE_CELL_ACTIVE_TOP,
  LIST_TABLE_CELL_STRONG_BOTTOM
);

/** Selected row while pointer is still over it — one step darker. */
export const LIST_TABLE_CELL_SELECTED_HOVER =
  "group-hover:bg-[color-mix(in_srgb,hsl(var(--border))_16%,hsl(var(--muted)))] dark:group-hover:bg-[color-mix(in_srgb,hsl(var(--background))_22%,hsl(var(--muted)))]";

/** @deprecated Use {@link LIST_TABLE_CELL_HOVER_BG} + {@link LIST_TABLE_CELL_HOVER_EDGE}. */
export const LIST_TABLE_CELL_HOVER = cn(LIST_TABLE_CELL_HOVER_BG, LIST_TABLE_CELL_HOVER_EDGE);

export function listTableRowClass(selected: boolean, clickable = true): string {
  return cn(
    LIST_TABLE_ROW_BASE,
    clickable && "cursor-pointer",
    selected && LIST_TABLE_ROW_SELECTED
  );
}

type BodyCellInteractionOptions = {
  /** Resting surface is muted (frozen / sticky leading column). */
  frozen?: boolean;
};

/** Hover/selection paint for a body cell (`group` on `<tr>`). */
export function listTableBodyCellInteractionClass(
  selected: boolean,
  options?: BodyCellInteractionOptions
): string {
  const frozen = options?.frozen ?? false;
  return cn(
    "border-t border-t-transparent transition-colors duration-100 ease-out",
    !selected && frozen && LIST_TABLE_FROZEN_CELL_BG,
    !selected && !frozen && "bg-background",
    selected
      ? cn(LIST_TABLE_CELL_SELECTED, LIST_TABLE_CELL_SELECTED_EDGE, LIST_TABLE_CELL_SELECTED_HOVER)
      : cn(LIST_TABLE_CELL_HOVER_BG, LIST_TABLE_CELL_HOVER_EDGE)
  );
}

/** @deprecated Use {@link listTableBodyCellInteractionClass}(selected, { frozen: true }). */
export function listTableFrozenBodyCellInteractionClass(selected: boolean): string {
  return listTableBodyCellInteractionClass(selected, { frozen: true });
}

/** Sticky leading column (e.g. bulk checkbox) — muted lane + unified interaction. */
export function listTableLeadingCellInteractionClass(selected: boolean): string {
  return listTableBodyCellInteractionClass(selected, { frozen: true });
}

/** List body slot — table fills remaining height (Items / Categories aligned). */
export const LIST_TABLE_ROOT =
  "relative min-h-0 min-w-0 w-full flex-1 basis-0 self-stretch";

/** Rounded outer frame; pair with {@link LIST_TABLE_ROOT}. */
export const LIST_TABLE_SURFACE =
  "surface-inset absolute inset-0 flex flex-col overflow-hidden !bg-background";

export const LIST_TABLE_SCROLL =
  "min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto overscroll-contain bg-background pb-px";

/**
 * Base `<table>` — always spans the scrollport (`w-full min-w-full`).
 * Horizontal overflow when column min-widths exceed the frame; last column stretches
 * via {@link stretchListTableColumnWidth} when it has no user-resized width.
 */
export const LIST_TABLE_ELEMENT_BASE =
  "w-full min-w-full border-separate border-spacing-0 bg-background text-left text-sm [&_td]:box-border [&_th]:box-border";
export const LIST_TABLE_MIN_WIDTH = {
  narrow: "min-w-[720px]",
  medium: "min-w-[760px]",
  wide: "min-w-[860px]",
} as const;

export type ListTableMinWidth = keyof typeof LIST_TABLE_MIN_WIDTH;

export function listTableElementClass(
  minWidth: ListTableMinWidth = "narrow",
  compactRows = false
): string {
  return cn(
    LIST_TABLE_ELEMENT_BASE,
    LIST_TABLE_MIN_WIDTH[minWidth],
    compactRows && "text-xs"
  );
}

export function listTableHeaderCornerClass(index: number, lastIndex: number): string {
  if (index === 0) return "rounded-tl-lg";
  if (index === lastIndex) return "rounded-tr-lg";
  return "";
}

export const LIST_TABLE_HEADER_CELL_BG = "bg-muted";

/** Frozen column body cells — muted at rest only; hover/selected use unified fills. */
export const LIST_TABLE_FROZEN_CELL_BG = LIST_TABLE_HEADER_CELL_BG;

export const LIST_TABLE_FROZEN_EDGE_SHADOW =
  "shadow-[inset_-12px_0_18px_-8px_hsl(var(--border)/0.55)] dark:shadow-[inset_-14px_0_18px_-10px_hsl(0_0%_0%/0.28)]";

export const LIST_TABLE_HEADER_CELL =
  "p-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground";

export const LIST_TABLE_HEADER_SORTABLE =
  "cursor-pointer select-none transition-colors hover:bg-[color-mix(in_srgb,hsl(var(--primary))_12%,hsl(var(--muted)))] dark:hover:bg-[color-mix(in_srgb,hsl(var(--accent))_40%,hsl(var(--muted)))]";

export const LIST_TABLE_BODY_CELL = cn(LIST_TABLE_ROW_DIVIDER, "p-2.5");

/** Bulk-select checkbox — border matches header label text (`text-muted-foreground`). */
export const LIST_TABLE_CHECKBOX_CLASS =
  "border-muted-foreground bg-background shadow-none hover:bg-background data-[state=checked]:border-muted-foreground data-[state=checked]:bg-muted-foreground data-[state=checked]:text-background";
