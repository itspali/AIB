import {
  loadListColumnPrefs,
  saveListColumnPrefs,
} from "@/lib/list-columns/prefs";
import type { ListColumnPrefs } from "@/lib/list-columns/types";
import {
  buildDefaultTableColumnPrefsByDevice,
  getTableColumnPrefsSlice,
  parseStoredTableColumnPrefsByDevice,
  setTableColumnPrefsSlice,
  setTableColumnPrefsSliceAllDevices,
  setTableColumnWidthInDeviceStore,
  TABLE_COLUMN_PREFS_BY_DEVICE_VERSION,
  type TableColumnPrefsByDevice,
} from "@/lib/list-columns/device-column-prefs";
import { parseFrozenColumnPref } from "@/lib/list-columns/use-frozen-list-columns";
import type { DeviceClass } from "@/lib/layout/device-class";
import { TAX_LIST_COLUMN_REGISTRY, isTaxKindFilter, type TaxListColumnId } from "@/lib/tax/list-columns";
import {
  DEFAULT_TAX_SORT_DIRECTION,
  DEFAULT_TAX_SORT_FIELD,
  type TaxListSortDirection,
  type TaxListSortField,
} from "@/lib/tax/list-sort";
import { AUTO_LAYOUT_PREF, type FrozenColumnPref } from "@/lib/products/list-prefs";
import type { TaxCodeKind } from "@/lib/tax/types";

export type TaxActiveStatusFilter = "all" | "active" | "inactive";
export type TaxKindFilter = TaxCodeKind | "all";

export type TaxListPrefs = {
  sortField: TaxListSortField;
  sortDirection: TaxListSortDirection;
  activeStatusFilter: TaxActiveStatusFilter;
  kindFilter: TaxKindFilter;
  columnPrefs: TableColumnPrefsByDevice<TaxListColumnId>;
  frozenColumnCount: FrozenColumnPref;
};

const STORAGE_KEY = "aib-tax-list-prefs";
const PREFS_VERSION = TABLE_COLUMN_PREFS_BY_DEVICE_VERSION;

export function getDefaultTaxListPrefs(): TaxListPrefs {
  return {
    sortField: DEFAULT_TAX_SORT_FIELD,
    sortDirection: DEFAULT_TAX_SORT_DIRECTION,
    activeStatusFilter: "all",
    kindFilter: "all",
    columnPrefs: buildDefaultTableColumnPrefsByDevice(TAX_LIST_COLUMN_REGISTRY),
    frozenColumnCount: AUTO_LAYOUT_PREF,
  };
}

export function getTaxColumnPrefsSlice(
  prefs: TaxListPrefs,
  deviceClass: DeviceClass
): ListColumnPrefs<TaxListColumnId> {
  return getTableColumnPrefsSlice(prefs.columnPrefs, deviceClass);
}

export function setTaxColumnPrefsSlice(
  prefs: TaxListPrefs,
  deviceClass: DeviceClass,
  slice: ListColumnPrefs<TaxListColumnId>
): TaxListPrefs {
  return {
    ...prefs,
    columnPrefs: setTableColumnPrefsSlice(prefs.columnPrefs, deviceClass, slice),
  };
}

export function setTaxColumnPrefsSliceAllDevices(
  prefs: TaxListPrefs,
  slice: ListColumnPrefs<TaxListColumnId>
): TaxListPrefs {
  return {
    ...prefs,
    columnPrefs: setTableColumnPrefsSliceAllDevices(prefs.columnPrefs, slice),
  };
}

function isTaxSortField(value: string): value is TaxListSortField {
  return (TAX_LIST_COLUMN_REGISTRY.ids as readonly string[]).includes(value);
}

function parseActiveStatusFilter(value: unknown): TaxActiveStatusFilter {
  if (value === "active" || value === "inactive") return value;
  return "all";
}

function parseKindFilter(value: unknown): TaxKindFilter {
  if (typeof value === "string" && isTaxKindFilter(value)) return value;
  return "all";
}

export function loadTaxListPrefs(): TaxListPrefs {
  const defaults = getDefaultTaxListPrefs();
  if (typeof window === "undefined") return defaults;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const legacyDesktop = loadListColumnPrefs(TAX_LIST_COLUMN_REGISTRY);
    if (!raw) {
      return {
        ...defaults,
        columnPrefs: buildDefaultTableColumnPrefsByDevice(TAX_LIST_COLUMN_REGISTRY, legacyDesktop),
      };
    }

    const parsed = JSON.parse(raw) as Partial<TaxListPrefs> & { prefsVersion?: number };
    const prefsVersion =
      typeof parsed.prefsVersion === "number" && Number.isFinite(parsed.prefsVersion)
        ? parsed.prefsVersion
        : 0;

    const sortField =
      typeof parsed.sortField === "string" && isTaxSortField(parsed.sortField)
        ? parsed.sortField
        : defaults.sortField;
    const sortDirection =
      parsed.sortDirection === "desc" ? "desc" : defaults.sortDirection;

    const columnPrefs = parseStoredTableColumnPrefsByDevice(
      TAX_LIST_COLUMN_REGISTRY,
      parsed.columnPrefs,
      {
        minVersion: PREFS_VERSION,
        storedVersion: prefsVersion,
        legacyFlat: legacyDesktop,
      }
    );

    return {
      sortField,
      sortDirection,
      activeStatusFilter: parseActiveStatusFilter(parsed.activeStatusFilter),
      kindFilter: parseKindFilter(parsed.kindFilter),
      columnPrefs,
      frozenColumnCount: parseFrozenColumnPref(parsed.frozenColumnCount),
    };
  } catch {
    return defaults;
  }
}

export function saveTaxListPrefs(prefs: TaxListPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...prefs, prefsVersion: PREFS_VERSION })
    );
    saveListColumnPrefs(
      TAX_LIST_COLUMN_REGISTRY,
      getTaxColumnPrefsSlice(prefs, "desktop")
    );
  } catch {
    // ignore quota errors
  }
}

export function setTaxColumnWidth(
  prefs: TaxListPrefs,
  deviceClass: DeviceClass,
  columnId: TaxListColumnId,
  width: number | null
): TaxListPrefs {
  return {
    ...prefs,
    columnPrefs: setTableColumnWidthInDeviceStore(
      prefs.columnPrefs,
      deviceClass,
      columnId,
      width
    ),
  };
}
