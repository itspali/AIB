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
  INVOICE_LIST_COLUMN_REGISTRY,
  type SalesInvoiceListColumnId,
} from "@/lib/sales/invoices/list-columns";
import {
  DEFAULT_INVOICE_SORT_DIRECTION,
  DEFAULT_INVOICE_SORT_FIELD,
  type SalesInvoiceListSortDirection,
  type SalesInvoiceListSortField,
} from "@/lib/sales/invoices/list-sort";
import type { SalesDocumentStatus } from "@/lib/sales/shared/document-status";
import type { SalesPaymentStatus } from "@/lib/sales/orders/types";
import { AUTO_LAYOUT_PREF, type FrozenColumnPref } from "@/lib/products/list-prefs";

const STORAGE_KEY = "aib:sales-invoice-list-prefs";
const PREFS_VERSION = TABLE_COLUMN_PREFS_BY_DEVICE_VERSION;

export type SalesInvoiceListPrefs = {
  customerId: string | null;
  status: SalesDocumentStatus | "all";
  paymentStatus: SalesPaymentStatus | "all";
  sortField: SalesInvoiceListSortField;
  sortDirection: SalesInvoiceListSortDirection;
  columnPrefs: TableColumnPrefsByDevice<SalesInvoiceListColumnId>;
  frozenColumnCount: FrozenColumnPref;
};

export function getDefaultSalesInvoiceListPrefs(): SalesInvoiceListPrefs {
  return {
    customerId: null,
    status: "all",
    paymentStatus: "all",
    sortField: DEFAULT_INVOICE_SORT_FIELD,
    sortDirection: DEFAULT_INVOICE_SORT_DIRECTION,
    columnPrefs: buildDefaultTableColumnPrefsByDevice(INVOICE_LIST_COLUMN_REGISTRY),
    frozenColumnCount: AUTO_LAYOUT_PREF,
  };
}

export function getSalesInvoiceColumnPrefsSlice(
  prefs: SalesInvoiceListPrefs,
  deviceClass: DeviceClass
): ListColumnPrefs<SalesInvoiceListColumnId> {
  return getTableColumnPrefsSlice(prefs.columnPrefs, deviceClass);
}

export function setSalesInvoiceColumnPrefsSlice(
  prefs: SalesInvoiceListPrefs,
  deviceClass: DeviceClass,
  slice: ListColumnPrefs<SalesInvoiceListColumnId>
): SalesInvoiceListPrefs {
  return {
    ...prefs,
    columnPrefs: setTableColumnPrefsSlice(prefs.columnPrefs, deviceClass, slice),
  };
}

export function setSalesInvoiceColumnPrefsSliceAllDevices(
  prefs: SalesInvoiceListPrefs,
  slice: ListColumnPrefs<SalesInvoiceListColumnId>
): SalesInvoiceListPrefs {
  return {
    ...prefs,
    columnPrefs: setTableColumnPrefsSliceAllDevices(prefs.columnPrefs, slice),
  };
}

function isInvoiceSortField(value: string): value is SalesInvoiceListSortField {
  return (INVOICE_LIST_COLUMN_REGISTRY.ids as readonly string[]).includes(value);
}

export function loadSalesInvoiceListPrefs(): SalesInvoiceListPrefs {
  const defaults = getDefaultSalesInvoiceListPrefs();
  if (typeof window === "undefined") return defaults;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const legacyDesktop = loadListColumnPrefs(INVOICE_LIST_COLUMN_REGISTRY);
    if (!raw) {
      return {
        ...defaults,
        columnPrefs: buildDefaultTableColumnPrefsByDevice(
          INVOICE_LIST_COLUMN_REGISTRY,
          legacyDesktop
        ),
      };
    }

    const parsed = JSON.parse(raw) as Partial<SalesInvoiceListPrefs> & { prefsVersion?: number };
    const prefsVersion =
      typeof parsed.prefsVersion === "number" && Number.isFinite(parsed.prefsVersion)
        ? parsed.prefsVersion
        : 0;
    const sortField =
      typeof parsed.sortField === "string" && isInvoiceSortField(parsed.sortField)
        ? parsed.sortField
        : defaults.sortField;
    const sortDirection = parsed.sortDirection === "asc" ? "asc" : defaults.sortDirection;

    const columnPrefs = parseStoredTableColumnPrefsByDevice(
      INVOICE_LIST_COLUMN_REGISTRY,
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
      paymentStatus: parsed.paymentStatus ?? "all",
      sortField,
      sortDirection,
      columnPrefs,
      frozenColumnCount: parseFrozenColumnPref(parsed.frozenColumnCount),
    };
  } catch {
    return defaults;
  }
}

export function saveSalesInvoiceListPrefs(prefs: SalesInvoiceListPrefs): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...prefs, prefsVersion: PREFS_VERSION })
  );
  saveListColumnPrefs(
    INVOICE_LIST_COLUMN_REGISTRY,
    getSalesInvoiceColumnPrefsSlice(prefs, "desktop")
  );
}

export function setSalesInvoiceColumnWidth(
  prefs: SalesInvoiceListPrefs,
  deviceClass: DeviceClass,
  columnId: SalesInvoiceListColumnId,
  width: number | null
): SalesInvoiceListPrefs {
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
