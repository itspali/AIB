const STORAGE_KEY = "aib:procurement-grn-list-prefs";

export type GoodsReceiptListPrefs = {
  locationId: string | null;
};

export function getDefaultGoodsReceiptListPrefs(): GoodsReceiptListPrefs {
  return { locationId: null };
}

export function loadGoodsReceiptListPrefs(): GoodsReceiptListPrefs {
  if (typeof window === "undefined") return getDefaultGoodsReceiptListPrefs();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultGoodsReceiptListPrefs();
    const parsed = JSON.parse(raw) as Partial<GoodsReceiptListPrefs>;
    return { locationId: parsed.locationId ?? null };
  } catch {
    return getDefaultGoodsReceiptListPrefs();
  }
}

export function saveGoodsReceiptListPrefs(prefs: GoodsReceiptListPrefs) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}
