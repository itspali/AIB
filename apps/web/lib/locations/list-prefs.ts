import {
  getDefaultListColumnPrefs,
  normalizeListColumnPrefs,
} from "@/lib/list-columns/prefs";
import type { ListColumnPrefs } from "@/lib/list-columns/types";
import type { LocationListColumnId } from "@/lib/locations/list-columns";
import {
  LOCATION_LIST_COLUMN_REGISTRY,
  type LocationListColumnId,
} from "@/lib/locations/list-columns";

export const LOCATION_LIST_PREFS_VERSION = 1;

export type LocationListPrefs = {
  prefsVersion: number;
  columnPrefs: ListColumnPrefs<LocationListColumnId>;
};

export function getDefaultLocationListPrefs(): LocationListPrefs {
  return {
    prefsVersion: LOCATION_LIST_PREFS_VERSION,
    columnPrefs: getDefaultListColumnPrefs(LOCATION_LIST_COLUMN_REGISTRY),
  };
}

export function coerceLocationListPrefs(raw: unknown): LocationListPrefs {
  const defaults = getDefaultLocationListPrefs();
  if (!raw || typeof raw !== "object") return defaults;

  const parsed = raw as Partial<LocationListPrefs> &
    Partial<ListColumnPrefs<LocationListColumnId>>;
  const columnPrefsSource =
    parsed.columnPrefs ??
    ("columnOrder" in parsed || "visibleColumns" in parsed || "columnChipDisplay" in parsed
      ? parsed
      : undefined);

  return {
    prefsVersion: LOCATION_LIST_PREFS_VERSION,
    columnPrefs: normalizeListColumnPrefs(
      LOCATION_LIST_COLUMN_REGISTRY,
      columnPrefsSource ?? defaults.columnPrefs
    ),
  };
}

export function loadLocationListPrefs(): LocationListPrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LOCATION_LIST_COLUMN_REGISTRY.storageKey);
    if (!raw) return null;
    return coerceLocationListPrefs(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveLocationListPrefs(prefs: LocationListPrefs): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      LOCATION_LIST_COLUMN_REGISTRY.storageKey,
      JSON.stringify({
        ...prefs,
        prefsVersion: LOCATION_LIST_PREFS_VERSION,
      })
    );
  } catch {
    /* ignore quota errors */
  }
}
