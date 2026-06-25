"use client";

import { useMemo } from "react";
import { getTableColumnPrefsSlice, type TableColumnPrefsByDevice } from "@/lib/list-columns/device-column-prefs";
import type { ListColumnPrefs } from "@/lib/list-columns/types";
import { useDeviceClass } from "@/hooks/use-device-class";

/** Resolves the column prefs slice for the current viewport breakpoint. */
export function useActiveTableColumnPrefs<TId extends string>(
  store: TableColumnPrefsByDevice<TId>
): {
  deviceClass: ReturnType<typeof useDeviceClass>["deviceClass"];
  slice: ListColumnPrefs<TId>;
} {
  const { deviceClass } = useDeviceClass();
  const slice = useMemo(
    () => getTableColumnPrefsSlice(store, deviceClass),
    [store, deviceClass]
  );
  return { deviceClass, slice };
}
