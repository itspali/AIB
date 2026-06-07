import type { StockTransferStatus } from "@/lib/inventory/transfers/types";

const STORAGE_KEY = "aib:inventory-transfers-list-prefs";

export type TransferListPrefs = {
  status: StockTransferStatus | "all";
  sourceLocationId: string | null;
};

export function getDefaultTransferListPrefs(): TransferListPrefs {
  return {
    status: "all",
    sourceLocationId: null,
  };
}

export function loadTransferListPrefs(): TransferListPrefs {
  if (typeof window === "undefined") return getDefaultTransferListPrefs();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultTransferListPrefs();
    const parsed = JSON.parse(raw) as Partial<TransferListPrefs>;
    return {
      status: parsed.status ?? "all",
      sourceLocationId: parsed.sourceLocationId ?? null,
    };
  } catch {
    return getDefaultTransferListPrefs();
  }
}

export function saveTransferListPrefs(prefs: TransferListPrefs) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}
