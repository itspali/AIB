import {
  getDefaultListColumnPrefs,
  loadListColumnPrefs,
  normalizeListColumnPrefs,
  saveListColumnPrefs,
} from "@/lib/list-columns/prefs";
import type { ListColumnPrefs } from "@/lib/list-columns/types";
import { TAX_LIST_COLUMN_REGISTRY, isTaxKindFilter, type TaxListColumnId } from "@/lib/tax/list-columns";
import {
  DEFAULT_TAX_SORT_DIRECTION,
  DEFAULT_TAX_SORT_FIELD,
  type TaxListSortDirection,
  type TaxListSortField,
} from "@/lib/tax/list-sort";
import { parseFrozenColumnPref } from "@/lib/list-columns/use-frozen-list-columns";
import { AUTO_LAYOUT_PREF, type FrozenColumnPref } from "@/lib/products/list-prefs";
import type { TaxCodeKind } from "@/lib/tax/types";

export type TaxActiveStatusFilter = "all" | "active" | "inactive";
export type TaxKindFilter = TaxCodeKind | "all";

export type TaxListPrefs = {
  sortField: TaxListSortField;
  sortDirection: TaxListSortDirection;
  activeStatusFilter: TaxActiveStatusFilter;
  kindFilter: TaxKindFilter;
  columnPrefs: ListColumnPrefs<TaxListColumnId>;
  frozenColumnCount: FrozenColumnPref;
};

const STORAGE_KEY = "aib-tax-list-prefs";
const PREFS_VERSION = 1;

export function getDefaultTaxListPrefs(): TaxListPrefs {
  return {
    sortField: DEFAULT_TAX_SORT_FIELD,
    sortDirection: DEFAULT_TAX_SORT_DIRECTION,
    activeStatusFilter: "all",
    kindFilter: "all",
    columnPrefs: getDefaultListColumnPrefs(TAX_LIST_COLUMN_REGISTRY),
    frozenColumnCount: AUTO_LAYOUT_PREF,
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
    if (!raw) {
      return {
        ...defaults,
        columnPrefs: loadListColumnPrefs(TAX_LIST_COLUMN_REGISTRY),
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

    const columnPrefs =
      prefsVersion >= PREFS_VERSION && parsed.columnPrefs
        ? normalizeListColumnPrefs(TAX_LIST_COLUMN_REGISTRY, parsed.columnPrefs)
        : loadListColumnPrefs(TAX_LIST_COLUMN_REGISTRY);

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
    saveListColumnPrefs(TAX_LIST_COLUMN_REGISTRY, prefs.columnPrefs);
  } catch {
    // ignore quota errors
  }
}

export function setTaxColumnWidth(
  prefs: TaxListPrefs,
  columnId: TaxListColumnId,
  width: number | null
): TaxListPrefs {
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
