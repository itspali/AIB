import {
  getDefaultListColumnPrefs,
  loadListColumnPrefs,
  normalizeListColumnPrefs,
  saveListColumnPrefs,
} from "@/lib/list-columns/prefs";
import type { ListColumnPrefs } from "@/lib/list-columns/types";
import { parseFrozenColumnPref } from "@/lib/list-columns/use-frozen-list-columns";
import {
  BILL_LIST_COLUMN_REGISTRY,
  type PurchaseBillListColumnId,
} from "@/lib/procurement/bills/list-columns";
import {
  DEFAULT_BILL_SORT_DIRECTION,
  DEFAULT_BILL_SORT_FIELD,
  type PurchaseBillListSortDirection,
  type PurchaseBillListSortField,
} from "@/lib/procurement/bills/list-sort";
import type { BillMatchStatus } from "@/lib/procurement/bills/three-way-match";
import { AUTO_LAYOUT_PREF, type FrozenColumnPref } from "@/lib/products/list-prefs";

const STORAGE_KEY = "aib:procurement-bill-list-prefs";
const PREFS_VERSION = 2;

export type PurchaseBillListPrefs = {
  supplierId: string | null;
  matchStatus: BillMatchStatus | "all";
  paidFilter: "all" | "paid" | "unpaid";
  /** Inclusive start date (YYYY-MM-DD) for created_at filter. */
  createdFrom: string | null;
  /** Inclusive end date (YYYY-MM-DD) for created_at filter. */
  createdTo: string | null;
  sortField: PurchaseBillListSortField;
  sortDirection: PurchaseBillListSortDirection;
  columnPrefs: ListColumnPrefs<PurchaseBillListColumnId>;
  frozenColumnCount: FrozenColumnPref;
};

export function getDefaultPurchaseBillListPrefs(): PurchaseBillListPrefs {
  return {
    supplierId: null,
    matchStatus: "all",
    paidFilter: "all",
    createdFrom: null,
    createdTo: null,
    sortField: DEFAULT_BILL_SORT_FIELD,
    sortDirection: DEFAULT_BILL_SORT_DIRECTION,
    columnPrefs: getDefaultListColumnPrefs(BILL_LIST_COLUMN_REGISTRY),
    frozenColumnCount: AUTO_LAYOUT_PREF,
  };
}

function isPurchaseBillSortField(value: string): value is PurchaseBillListSortField {
  return (BILL_LIST_COLUMN_REGISTRY.ids as readonly string[]).includes(value);
}

export function loadPurchaseBillListPrefs(): PurchaseBillListPrefs {
  const defaults = getDefaultPurchaseBillListPrefs();
  if (typeof window === "undefined") return defaults;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        ...defaults,
        columnPrefs: loadListColumnPrefs(BILL_LIST_COLUMN_REGISTRY),
      };
    }

    const parsed = JSON.parse(raw) as Partial<PurchaseBillListPrefs> & { prefsVersion?: number };
    const sortField =
      typeof parsed.sortField === "string" && isPurchaseBillSortField(parsed.sortField)
        ? parsed.sortField
        : defaults.sortField;
    const sortDirection = parsed.sortDirection === "asc" ? "asc" : defaults.sortDirection;

    const columnPrefs =
      parsed.prefsVersion >= PREFS_VERSION && parsed.columnPrefs
        ? normalizeListColumnPrefs(BILL_LIST_COLUMN_REGISTRY, parsed.columnPrefs)
        : loadListColumnPrefs(BILL_LIST_COLUMN_REGISTRY);

    return {
      supplierId: parsed.supplierId ?? null,
      matchStatus: parsed.matchStatus ?? "all",
      paidFilter: parsed.paidFilter ?? "all",
      createdFrom: parsed.createdFrom ?? null,
      createdTo: parsed.createdTo ?? null,
      sortField,
      sortDirection,
      columnPrefs,
      frozenColumnCount: parseFrozenColumnPref(parsed.frozenColumnCount),
    };
  } catch {
    return defaults;
  }
}

export function savePurchaseBillListPrefs(prefs: PurchaseBillListPrefs): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...prefs, prefsVersion: PREFS_VERSION })
  );
  saveListColumnPrefs(BILL_LIST_COLUMN_REGISTRY, prefs.columnPrefs);
}

export function setPurchaseBillColumnWidth(
  prefs: PurchaseBillListPrefs,
  columnId: PurchaseBillListColumnId,
  width: number | null
): PurchaseBillListPrefs {
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
