export type ListColumnAlign = "left" | "right" | "center";

export type ListColumnDef<TId extends string = string> = {
  id: TId;
  label: string;
  defaultVisible: boolean;
  align?: ListColumnAlign;
  /** Optional grouping label shown in the column selector dropdown. */
  group?: string;
  /** Permission key for role-based visibility (defaults to column id). */
  permissionKey?: string;
};

export type ListColumnRegistry<TId extends string = string> = {
  ids: readonly TId[];
  columns: ListColumnDef<TId>[];
  storageKey: string;
};

export type ListColumnPrefs<TId extends string = string> = {
  columnOrder: TId[];
  visibleColumns: TId[];
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
