import type { StockListViewMode } from "@/lib/inventory/stock/types";

export type StockListPrefs = {
  viewMode: StockListViewMode;
  locationId: string | null;
};

const STORAGE_KEY = "aib-stock-list-prefs";

export function getDefaultStockListPrefs(): StockListPrefs {
  return {
    viewMode: "balances",
    locationId: null,
  };
}

export function loadStockListPrefs(): StockListPrefs {
  if (typeof window === "undefined") return getDefaultStockListPrefs();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultStockListPrefs();
    const parsed = JSON.parse(raw) as Partial<StockListPrefs>;
    const viewMode = parsed.viewMode === "adjustments" ? "adjustments" : "balances";
    const locationId =
      typeof parsed.locationId === "string" && parsed.locationId.trim()
        ? parsed.locationId.trim()
        : null;
    return { viewMode, locationId };
  } catch {
    return getDefaultStockListPrefs();
  }
}

export function saveStockListPrefs(prefs: StockListPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore quota errors
  }
}
