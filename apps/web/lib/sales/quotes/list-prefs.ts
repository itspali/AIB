import {
  getDefaultListColumnPrefs,
  loadListColumnPrefs,
  normalizeListColumnPrefs,
  saveListColumnPrefs,
} from "@/lib/list-columns/prefs";
import type { ListColumnPrefs } from "@/lib/list-columns/types";
import { parseFrozenColumnPref } from "@/lib/list-columns/use-frozen-list-columns";
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
const PREFS_VERSION = 1;

export type SalesQuoteListPrefs = {
  customerId: string | null;
  status: SalesDocumentStatus | "all";
  sortField: SalesQuoteListSortField;
  sortDirection: SalesQuoteListSortDirection;
  columnPrefs: ListColumnPrefs<SalesQuoteListColumnId>;
  frozenColumnCount: FrozenColumnPref;
};

export function getDefaultSalesQuoteListPrefs(): SalesQuoteListPrefs {
  return {
    customerId: null,
    status: "all",
    sortField: DEFAULT_QUOTE_SORT_FIELD,
    sortDirection: DEFAULT_QUOTE_SORT_DIRECTION,
    columnPrefs: getDefaultListColumnPrefs(QUOTE_LIST_COLUMN_REGISTRY),
    frozenColumnCount: AUTO_LAYOUT_PREF,
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
    if (!raw) {
      return {
        ...defaults,
        columnPrefs: loadListColumnPrefs(QUOTE_LIST_COLUMN_REGISTRY),
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

    const columnPrefs =
      prefsVersion >= PREFS_VERSION && parsed.columnPrefs
        ? normalizeListColumnPrefs(QUOTE_LIST_COLUMN_REGISTRY, parsed.columnPrefs)
        : loadListColumnPrefs(QUOTE_LIST_COLUMN_REGISTRY);

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
  saveListColumnPrefs(QUOTE_LIST_COLUMN_REGISTRY, prefs.columnPrefs);
}

export function setSalesQuoteColumnWidth(
  prefs: SalesQuoteListPrefs,
  columnId: SalesQuoteListColumnId,
  width: number | null
): SalesQuoteListPrefs {
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
