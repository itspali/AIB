import {
  columnSupportsWrapControl,
  defaultWrapModeForValueKind,
  type TextWrapMode,
} from "@/lib/display/text-wrap";
import { getOrderedVisibleColumns as getOrderedVisibleListColumns } from "@/lib/list-columns/prefs";
import type { ListColumnPrefs } from "@/lib/list-columns/types";
import { filterAllowedColumnIds } from "@/lib/products/field-permissions";
import { getColumnDef, type ProductListColumnId } from "@/lib/products/list-columns";
import {
  getColumnPrefsSlice,
  type DeviceClass,
  type ProductListPrefs,
  type ProductListViewMode,
} from "@/lib/products/list-prefs";

type ResolveVisibleColumnsInput = {
  prefs: ProductListPrefs;
  viewMode: ProductListViewMode;
  deviceClass: DeviceClass;
  allowedFields: readonly string[];
};

export function resolveVisibleColumns({
  prefs,
  viewMode,
  deviceClass,
  allowedFields,
}: ResolveVisibleColumnsInput): ProductListColumnId[] {
  const slice = getColumnPrefsSlice(prefs, viewMode, deviceClass);
  const orderedVisible = getOrderedVisibleListColumns(slice);
  return filterAllowedColumnIds(orderedVisible, allowedFields);
}

export function resolveColumnWrapMode(
  columnId: ProductListColumnId,
  columnPrefs: ListColumnPrefs<ProductListColumnId>,
  viewMode: ProductListViewMode
): TextWrapMode {
  const column = getColumnDef(columnId);
  if (!columnSupportsWrapControl(column.valueKind)) {
    return "truncate";
  }

  const override = columnPrefs.columnWrapModes?.[columnId];
  if (override) return override;
  if (column.defaultWrapMode) return column.defaultWrapMode;
  return defaultWrapModeForValueKind(column.valueKind!, viewMode);
}

export function resolveColumnWrapModes(
  columnIds: readonly ProductListColumnId[],
  columnPrefs: ListColumnPrefs<ProductListColumnId>,
  viewMode: ProductListViewMode
): Partial<Record<ProductListColumnId, TextWrapMode>> {
  const result: Partial<Record<ProductListColumnId, TextWrapMode>> = {};
  for (const columnId of columnIds) {
    result[columnId] = resolveColumnWrapMode(columnId, columnPrefs, viewMode);
  }
  return result;
}

export function filterAllowedColumnPrefs<TId extends string>(
  columnOrder: readonly TId[],
  visibleColumns: readonly TId[],
  allowedFields: readonly string[]
): { columnOrder: TId[]; visibleColumns: TId[] } {
  const allowedOrder = filterAllowedColumnIds(columnOrder, allowedFields);
  const allowedVisible = filterAllowedColumnIds(visibleColumns, allowedFields);
  return {
    columnOrder: allowedOrder,
    visibleColumns: allowedVisible,
  };
}
