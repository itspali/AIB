import type { PurchaseOrderStatus } from "@/lib/procurement/purchase-orders/types";

const STORAGE_KEY = "aib:procurement-po-list-prefs";

export type PurchaseOrderListPrefs = {
  status: PurchaseOrderStatus | "all";
  locationId: string | null;
};

export function getDefaultPurchaseOrderListPrefs(): PurchaseOrderListPrefs {
  return {
    status: "all",
    locationId: null,
  };
}

export function loadPurchaseOrderListPrefs(): PurchaseOrderListPrefs {
  if (typeof window === "undefined") return getDefaultPurchaseOrderListPrefs();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultPurchaseOrderListPrefs();
    const parsed = JSON.parse(raw) as Partial<PurchaseOrderListPrefs>;
    return {
      status: parsed.status ?? "all",
      locationId: parsed.locationId ?? null,
    };
  } catch {
    return getDefaultPurchaseOrderListPrefs();
  }
}

export function savePurchaseOrderListPrefs(prefs: PurchaseOrderListPrefs) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}
