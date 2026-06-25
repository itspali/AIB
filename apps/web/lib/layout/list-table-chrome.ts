import { cn } from "@/lib/utils";

/** Resting row divider — always on body cells. */
export const LIST_TABLE_ROW_DIVIDER = "box-border border-b border-border";

export const LIST_TABLE_ROW_BASE =
  "group box-border transition-colors duration-100 ease-out";

/** Items registry row — row-level hover/selection via `.matrix-table__row--*`. */
export const LIST_WORKSPACE_REGISTRY_ROW_BASE =
  "transition-colors duration-200 ease-out";

/** Selected row outline — classic list modules outside Glass V2 registry tables. */
export const LIST_TABLE_ROW_SELECTED = "ring-1 ring-inset ring-border/70 dark:ring-border/55";

/** Active peek/selection row — Items matrix master. */
export const LIST_WORKSPACE_REGISTRY_ROW_ACTIVE = "matrix-table__row--active";

/** Inactive catalog row — Items matrix master. */
export const LIST_WORKSPACE_REGISTRY_ROW_INACTIVE = "matrix-table__row--inactive";

/** Bulk-select body cell — Items matrix master. */
export const LIST_WORKSPACE_REGISTRY_SELECT_CELL = "matrix-table__select";

/** Matrix registry frozen body/header lane — row-state surfaces match select column. */
export const LIST_TABLE_FROZEN_CELL = "matrix-table__frozen";

/** Inner flex wrapper — aligns row checkboxes with header bulk select. */
export const LIST_WORKSPACE_REGISTRY_SELECT_CELL_INNER = "flex items-center justify-start";

export type ListTableInteractionSurface = "registry" | "classic";

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

export function listTableRowClass(
  selected: boolean,
  clickable = true,
  inactive = false,
  surface: ListTableInteractionSurface = "registry"
): string {
  if (surface === "registry") {
    return cn(
      LIST_WORKSPACE_REGISTRY_ROW_BASE,
      clickable && "cursor-pointer",
      inactive && LIST_WORKSPACE_REGISTRY_ROW_INACTIVE,
      selected && LIST_WORKSPACE_REGISTRY_ROW_ACTIVE
    );
  }
  return cn(
    LIST_TABLE_ROW_BASE,
    clickable && "cursor-pointer",
    selected && LIST_TABLE_ROW_SELECTED
  );
}

type BodyCellInteractionOptions = {
  /** Resting surface is muted (frozen / sticky leading column). */
  frozen?: boolean;
  surface?: ListTableInteractionSurface;
};

/** Hover/selection paint for a body cell (`group` on `<tr>` for classic; row classes for registry). */
export function listTableBodyCellInteractionClass(
  selected: boolean,
  options?: BodyCellInteractionOptions
): string {
  const frozen = options?.frozen ?? false;
  const surface = options?.surface ?? "registry";
  if (surface === "registry") {
    return cn(frozen && LIST_TABLE_FROZEN_CELL);
  }
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

/** Sticky leading column (e.g. bulk checkbox) — Items registry select lane. */
export function listTableLeadingCellInteractionClass(
  _selected: boolean,
  surface: ListTableInteractionSurface = "registry"
): string {
  if (surface === "registry") {
    return LIST_WORKSPACE_REGISTRY_SELECT_CELL;
  }
  return listTableBodyCellInteractionClass(_selected, { frozen: true, surface: "classic" });
}

/** List body slot — table fills remaining height (Items / Categories aligned). */
export const LIST_TABLE_ROOT =
  "relative min-h-0 min-w-0 w-full flex-1 basis-0 self-stretch";

/** Rounded outer frame; pair with {@link LIST_TABLE_ROOT}. */
export const LIST_TABLE_SURFACE =
  "surface-inset table-chrome-frame absolute inset-0 flex flex-col overflow-hidden !bg-background";

export const LIST_TABLE_SCROLL =
  "min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto overscroll-contain bg-background pb-px";

/**
 * Base `<table>` — always spans the scrollport (`w-full min-w-full`).
 * Horizontal overflow when column min-widths exceed the frame; last column stretches
 * via {@link stretchListTableColumnWidth} when it has no user-resized width.
 */
/** Items-master registry table — canonical header/body chrome for all list modules. */
export const LIST_WORKSPACE_REGISTRY_TABLE = "matrix-table list-workspace-registry-table";
export const LIST_WORKSPACE_REGISTRY_TABLE_WRAPPER = "matrix-table-wrapper";

/** Items `matrix-table__header` — single source for every list module header cell. */
export const LIST_WORKSPACE_REGISTRY_HEADER = "matrix-table__header";
export const LIST_WORKSPACE_REGISTRY_HEADER_SELECT = "matrix-table__select";
export const LIST_WORKSPACE_REGISTRY_HEADER_LABEL = "matrix-table__header-label";
export const LIST_WORKSPACE_REGISTRY_HEADER_BTN = "matrix-table__header-btn";
export const LIST_WORKSPACE_REGISTRY_HEADER_BTN_ACTIVE = "matrix-table__header-btn--active";

export const LIST_TABLE_ELEMENT_BASE =
  "table-chrome w-full min-w-full border-separate border-spacing-0 bg-background text-left text-sm [&_td]:box-border [&_th]:box-border";
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
    LIST_WORKSPACE_REGISTRY_TABLE,
    LIST_TABLE_MIN_WIDTH[minWidth],
    compactRows && "text-xs"
  );
}

/** Items-master `<table>` class without document `table-chrome` frame tokens. */
export function listWorkspaceRegistryTableClass(
  minWidth: ListTableMinWidth = "narrow",
  compactRows = false
): string {
  return cn(
    LIST_WORKSPACE_REGISTRY_TABLE,
    "w-full min-w-full border-separate border-spacing-0 text-left text-sm [&_td]:box-border [&_th]:box-border",
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

/** Frozen column body cells — classic surface muted at rest (registry uses {@link LIST_TABLE_FROZEN_CELL} + CSS). */
export const LIST_TABLE_FROZEN_CELL_BG = LIST_TABLE_HEADER_CELL_BG;

/** 1px inset rule at the trailing edge of the frozen block — matches `--lw-matrix-column-rule`. */
export const LIST_TABLE_FROZEN_EDGE = "matrix-table__frozen-edge";

/** @deprecated Use {@link LIST_TABLE_FROZEN_EDGE}. */
export const LIST_TABLE_FROZEN_EDGE_SHADOW = LIST_TABLE_FROZEN_EDGE;

export const LIST_TABLE_HEADER_CELL =
  "p-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground";

/** Horizontal inset per side (`p-2.5` / matrix header padding). Auto-fit sums both sides. */
export const LIST_TABLE_CELL_PADDING_INLINE_PX = 10;

/** Invisible drag target at the trailing header edge; visual rule stays 1px. */
export const LIST_TABLE_COLUMN_RESIZE_HIT_PX = 2;

/** Matrix tables draw separators on cells; handle is interaction-only. */
export const MATRIX_TABLE_COLUMN_RESIZE_HANDLE_CLASS = "matrix-table__resize-handle";

/** Matrix auto-fit width padding — horizontal cell inset (header separators are non-layout pseudo elements). */
export function matrixTableAutoFitHorizontalPaddingPx(): number {
  return LIST_TABLE_CELL_PADDING_INLINE_PX * 2;
}

/** Inset header bottom rule — matches {@link LIST_TABLE_FROZEN_EDGE} and matrix column separators (`--lw-matrix-column-rule`). */
export const LIST_WORKSPACE_REGISTRY_HEADER_EDGE =
  "shadow-[inset_0_-1px_0_0_hsl(var(--muted))]";

export const LIST_TABLE_HEADER_SORT_ACTIVE = "text-primary";

export function listTableSortHeaderClass(active: boolean): string | undefined {
  return active ? LIST_TABLE_HEADER_SORT_ACTIVE : undefined;
}

export const LIST_TABLE_HEADER_SORTABLE =
  "cursor-pointer select-none transition-colors hover:bg-[color-mix(in_srgb,hsl(var(--primary))_12%,hsl(var(--muted)))] dark:hover:bg-[color-mix(in_srgb,hsl(var(--accent))_40%,hsl(var(--muted)))]";

export const LIST_TABLE_BODY_CELL = cn(LIST_TABLE_ROW_DIVIDER, "p-2.5");

/** Line-1 primary scan target (customer, supplier, entity name). */
export const LIST_TABLE_CELL_PRIMARY = "matrix-table__prose matrix-table__prose--primary";

/** Secondary descriptive field (origin, location name, vendor ref). */
export const LIST_TABLE_CELL_SECONDARY = "matrix-table__prose matrix-table__prose--muted";

/** Line-2 muted subtext (codes, location abbreviations). */
export const LIST_TABLE_CELL_SUBLINE = "matrix-table__subline block";

/** Mono document / voucher numbers — Items `matrix-table__code` parity. */
export const LIST_TABLE_CELL_MONO_DOC = "matrix-table__code";

/** Mono secondary reference (linked PO numbers, etc.). */
export const LIST_TABLE_CELL_MONO_REF = "matrix-table__code matrix-table__code--muted";

/** Primary monetary column — Items `matrix-table__numeric` parity. */
export const LIST_TABLE_CELL_AMOUNT = "matrix-table__numeric";

/** Secondary numeric metadata (line counts, quantities). */
export const LIST_TABLE_CELL_COUNT = "matrix-table__numeric matrix-table__numeric--muted";

/** Chip / status fallback when chips are disabled — inherits table `text-sm`. */
export const LIST_TABLE_CELL_STATUS = "font-medium";

/** Plain-text fallback for chip-eligible columns when chip mode is off. */
export const LIST_TABLE_CELL_CHIP_FALLBACK = LIST_TABLE_CELL_STATUS;

/** Date and timestamp columns — Items muted numeric lane. */
export const LIST_TABLE_CELL_DATE = "matrix-table__numeric matrix-table__numeric--muted";

/** Bulk-select checkbox — border matches header label text (`text-muted-foreground`). */
export const LIST_TABLE_CHECKBOX_CLASS =
  "border-muted-foreground bg-background shadow-none hover:bg-background data-[state=checked]:border-muted-foreground data-[state=checked]:bg-muted-foreground data-[state=checked]:text-background";

/** Items list workspace (split feed + matrix) — square control with rounded corners. */
export const LIST_WORKSPACE_BULK_CHECKBOX_CLASS = cn(
  LIST_TABLE_CHECKBOX_CLASS,
  "list-workspace-bulk-checkbox",
  "data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
  "data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground"
);

/** Matrix/split bulk-select lane — capability on and at least one matching row can be selected. */
export function listWorkspaceBulkSelectionColumnEnabled(
  capabilityEnabled: boolean,
  selectableMatchingCount: number
): boolean {
  return capabilityEnabled && selectableMatchingCount > 0;
}
