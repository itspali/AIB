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
