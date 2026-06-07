import type { TextWrapMode } from "@/lib/display/text-wrap";
import type { ResponsiveColumnWidths } from "@/lib/list-columns/sizing";

export type ListColumnAlign = "left" | "right" | "center";

export type ListColumnValueKind =
  | "text"
  | "multiline"
  | "code"
  | "number"
  | "boolean"
  | "date";

export type ChipColorPreset =
  | "emerald"
  | "red"
  | "amber"
  | "indigo"
  | "sky"
  | "violet"
  | "slate"
  | "neutral";

export type ColumnValueColorRule = {
  preset?: ChipColorPreset;
  /** "#RRGGBB" — when set, overrides preset */
  customHex?: string;
};

export type ColumnChipDisplay = {
  mode: "text" | "chip";
  valueColors?: Record<string, ColumnValueColorRule>;
};

/** Fallback key for unmapped dynamic enum values (e.g. category names). */
export const CHIP_DEFAULT_FALLBACK_KEY = "__default__";

export type ListColumnDef<TId extends string = string> = {
  id: TId;
  label: string;
  defaultVisible: boolean;
  align?: ListColumnAlign;
  /** Optional grouping label shown in the column selector dropdown. */
  group?: string;
  /** Permission key for role-based visibility (defaults to column id). */
  permissionKey?: string;
  /** Drives wrap controls in the column selector for text-like columns. */
  valueKind?: ListColumnValueKind;
  defaultWrapMode?: TextWrapMode;
  /** Responsive min/max/preferred widths for table cells (per device tier). */
  widths?: ResponsiveColumnWidths;
  /** Extra min-width pixels when wrap mode is line-clamp-2 or wrap. */
  wrapWidthBoost?: number;
  /** When true, column selector offers chip display + per-value colors. */
  chipEligible?: boolean;
  /** Static value catalog for chip color rules; dynamic columns use CHIP_DEFAULT_FALLBACK_KEY. */
  chipValueCatalog?: readonly { value: string; label: string }[];
  /** Module-specific default color rules keyed by stable value id. */
  chipDefaultColors?: Record<string, ColumnValueColorRule>;
};

export type ListColumnRegistry<TId extends string = string> = {
  ids: readonly TId[];
  columns: ListColumnDef<TId>[];
  storageKey: string;
};

export type ListColumnPrefs<TId extends string = string> = {
  columnOrder: TId[];
  visibleColumns: TId[];
  columnWrapModes?: Partial<Record<TId, TextWrapMode>>;
  /** User-resized column widths in pixels (table view, per device slice). */
  columnWidths?: Partial<Record<TId, number>>;
  /** Per-column chip display mode and value color overrides. */
  columnChipDisplay?: Partial<Record<TId, ColumnChipDisplay>>;
};

export function getDefaultColumnOrder<TId extends string>(
  registry: ListColumnRegistry<TId>
): TId[] {
  return registry.columns.map((column) => column.id);
}

export function getDefaultVisibleColumns<TId extends string>(
  registry: ListColumnRegistry<TId>
): TId[] {
  return registry.columns.filter((column) => column.defaultVisible).map((column) => column.id);
}

export function getColumnDef<TId extends string>(
  registry: ListColumnRegistry<TId>,
  id: TId
): ListColumnDef<TId> {
  return registry.columns.find((column) => column.id === id)!;
}

export function isColumnId<TId extends string>(
  registry: ListColumnRegistry<TId>,
  value: string
): value is TId {
  return (registry.ids as readonly string[]).includes(value);
}
