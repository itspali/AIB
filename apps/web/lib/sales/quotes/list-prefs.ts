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
import {
  QUOTE_LIST_COLUMN_REGISTRY,
  type SalesQuoteListColumnId,
} from "@/lib/sales/quotes/list-columns";
import {
  DEFAULT_QUOTE_SORT_DIRECTION,
  DEFAULT_QUOTE_SORT_FIELD,
  type SalesQuoteListSortDirection,
  type SalesQuoteListSortField,
} from "@/lib/sales/quotes/list-sort";
import type { SalesDocumentStatus } from "@/lib/sales/shared/document-status";
import { AUTO_LAYOUT_PREF, type FrozenColumnPref } from "@/lib/products/list-prefs";

const STORAGE_KEY = "aib:sales-quote-list-prefs";
const PREFS_VERSION = TABLE_COLUMN_PREFS_BY_DEVICE_VERSION;

export type SalesQuoteListStatusFilter = SalesDocumentStatus | "all" | "SENT";

export type SalesQuoteListPrefs = {
  customerId: string | null;
  status: SalesQuoteListStatusFilter;
  sortField: SalesQuoteListSortField;
  sortDirection: SalesQuoteListSortDirection;
  columnPrefs: TableColumnPrefsByDevice<SalesQuoteListColumnId>;
  frozenColumnCount: FrozenColumnPref;
};

export function getDefaultSalesQuoteListPrefs(): SalesQuoteListPrefs {
  return {
    customerId: null,
    status: "all",
    sortField: DEFAULT_QUOTE_SORT_FIELD,
    sortDirection: DEFAULT_QUOTE_SORT_DIRECTION,
    columnPrefs: buildDefaultTableColumnPrefsByDevice(QUOTE_LIST_COLUMN_REGISTRY),
    frozenColumnCount: AUTO_LAYOUT_PREF,
  };
}

export function getSalesQuoteColumnPrefsSlice(
  prefs: SalesQuoteListPrefs,
  deviceClass: DeviceClass
): ListColumnPrefs<SalesQuoteListColumnId> {
  return getTableColumnPrefsSlice(prefs.columnPrefs, deviceClass);
}

export function setSalesQuoteColumnPrefsSlice(
  prefs: SalesQuoteListPrefs,
  deviceClass: DeviceClass,
  slice: ListColumnPrefs<SalesQuoteListColumnId>
): SalesQuoteListPrefs {
  return {
    ...prefs,
    columnPrefs: setTableColumnPrefsSlice(prefs.columnPrefs, deviceClass, slice),
  };
}

export function setSalesQuoteColumnPrefsSliceAllDevices(
  prefs: SalesQuoteListPrefs,
  slice: ListColumnPrefs<SalesQuoteListColumnId>
): SalesQuoteListPrefs {
  return {
    ...prefs,
    columnPrefs: setTableColumnPrefsSliceAllDevices(prefs.columnPrefs, slice),
  };
}

function isQuoteSortField(value: string): value is SalesQuoteListSortField {
  return (QUOTE_LIST_COLUMN_REGISTRY.ids as readonly string[]).includes(value);
}

export function loadSalesQuoteListPrefs(): SalesQuoteListPrefs {
  const defaults = getDefaultSalesQuoteListPrefs();
  if (typeof window === "undefined") return defaults;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const legacyDesktop = loadListColumnPrefs(QUOTE_LIST_COLUMN_REGISTRY);
    if (!raw) {
      return {
        ...defaults,
        columnPrefs: buildDefaultTableColumnPrefsByDevice(QUOTE_LIST_COLUMN_REGISTRY, legacyDesktop),
      };
    }

    const parsed = JSON.parse(raw) as Partial<SalesQuoteListPrefs> & { prefsVersion?: number };
    const prefsVersion =
      typeof parsed.prefsVersion === "number" && Number.isFinite(parsed.prefsVersion)
        ? parsed.prefsVersion
        : 0;
    const sortField =
      typeof parsed.sortField === "string" && isQuoteSortField(parsed.sortField)
        ? parsed.sortField
        : defaults.sortField;
    const sortDirection = parsed.sortDirection === "asc" ? "asc" : defaults.sortDirection;

    const columnPrefs = parseStoredTableColumnPrefsByDevice(
      QUOTE_LIST_COLUMN_REGISTRY,
      parsed.columnPrefs,
      {
        minVersion: PREFS_VERSION,
        storedVersion: prefsVersion,
        legacyFlat: legacyDesktop,
      }
    );

    return {
      customerId: parsed.customerId ?? null,
      status: parsed.status ?? "all",
      sortField,
      sortDirection,
      columnPrefs,
      frozenColumnCount: parseFrozenColumnPref(parsed.frozenColumnCount),
    };
  } catch {
    return defaults;
  }
}

export function saveSalesQuoteListPrefs(prefs: SalesQuoteListPrefs): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...prefs, prefsVersion: PREFS_VERSION })
  );
  saveListColumnPrefs(
    QUOTE_LIST_COLUMN_REGISTRY,
    getSalesQuoteColumnPrefsSlice(prefs, "desktop")
  );
}

export function setSalesQuoteColumnWidth(
  prefs: SalesQuoteListPrefs,
  deviceClass: DeviceClass,
  columnId: SalesQuoteListColumnId,
  width: number | null
): SalesQuoteListPrefs {
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
