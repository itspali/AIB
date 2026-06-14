import {
  getDefaultListColumnPrefs,
  loadListColumnPrefs,
  normalizeListColumnPrefs,
  saveListColumnPrefs,
} from "@/lib/list-columns/prefs";
import type { ListColumnPrefs } from "@/lib/list-columns/types";
import { parseFrozenColumnPref } from "@/lib/list-columns/use-frozen-list-columns";
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
const PREFS_VERSION = 1;

export type SalesInvoiceListPrefs = {
  customerId: string | null;
  status: SalesDocumentStatus | "all";
  paymentStatus: SalesPaymentStatus | "all";
  sortField: SalesInvoiceListSortField;
  sortDirection: SalesInvoiceListSortDirection;
  columnPrefs: ListColumnPrefs<SalesInvoiceListColumnId>;
  frozenColumnCount: FrozenColumnPref;
};

export function getDefaultSalesInvoiceListPrefs(): SalesInvoiceListPrefs {
  return {
    customerId: null,
    status: "all",
    paymentStatus: "all",
    sortField: DEFAULT_INVOICE_SORT_FIELD,
    sortDirection: DEFAULT_INVOICE_SORT_DIRECTION,
    columnPrefs: getDefaultListColumnPrefs(INVOICE_LIST_COLUMN_REGISTRY),
    frozenColumnCount: AUTO_LAYOUT_PREF,
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
    if (!raw) {
      return {
        ...defaults,
        columnPrefs: loadListColumnPrefs(INVOICE_LIST_COLUMN_REGISTRY),
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

    const columnPrefs =
      prefsVersion >= PREFS_VERSION && parsed.columnPrefs
        ? normalizeListColumnPrefs(INVOICE_LIST_COLUMN_REGISTRY, parsed.columnPrefs)
        : loadListColumnPrefs(INVOICE_LIST_COLUMN_REGISTRY);

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
  saveListColumnPrefs(INVOICE_LIST_COLUMN_REGISTRY, prefs.columnPrefs);
}

export function setSalesInvoiceColumnWidth(
  prefs: SalesInvoiceListPrefs,
  columnId: SalesInvoiceListColumnId,
  width: number | null
): SalesInvoiceListPrefs {
  const columnWidths = { ...(prefs.columnPrefs.columnWidths ?? {}) };
  if (width == null) {
    delete columnWidths[columnId];
  } else {
    columnWidths[columnId] = width;
  }
  return {
    ...prefs,
    columnPrefs: {
      ...prefs.columnPrefs,
      columnWidths: Object.keys(columnWidths).length > 0 ? columnWidths : undefined,
    },
  };
}
