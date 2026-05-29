import { getOrderedVisibleColumns as getOrderedVisibleListColumns } from "@/lib/list-columns/prefs";
import { filterAllowedColumnIds } from "@/lib/products/field-permissions";
import type { ProductListColumnId } from "@/lib/products/list-columns";
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
