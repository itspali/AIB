"use client";

import { ListColumnSettings } from "@/components/list-columns/list-column-settings";
import {
  LOCATION_LIST_COLUMN_IDS,
  LOCATION_LIST_COLUMN_REGISTRY,
  type LocationListColumnId,
} from "@/lib/locations/list-columns";
import type { LocationListPrefs } from "@/lib/locations/list-prefs";

type Props = {
  prefs: LocationListPrefs;
  onChange: (prefs: LocationListPrefs) => void;
  disabled?: boolean;
  triggerClassName?: string;
};

export function LocationListColumnSettings({
  prefs,
  onChange,
  disabled = false,
  triggerClassName,
}: Props) {
  return (
    <ListColumnSettings
      registry={LOCATION_LIST_COLUMN_REGISTRY}
      prefs={prefs.columnPrefs}
      allowedColumnIds={LOCATION_LIST_COLUMN_IDS}
      editingLayout="table"
      editingDevice="desktop"
      detectedDevice="desktop"
      onEditingLayoutChange={() => {}}
      onEditingDeviceChange={() => {}}
      onChange={(columnPrefs) => onChange({ ...prefs, columnPrefs })}
      disabled={disabled}
      triggerClassName={triggerClassName}
      triggerVariant="outline"
    />
  );
}

export function getLocationChipDisplay(
  prefs: LocationListPrefs
): Partial<Record<LocationListColumnId, import("@/lib/list-columns/types").ColumnChipDisplay>> {
  return prefs.columnPrefs.columnChipDisplay ?? {};
}
