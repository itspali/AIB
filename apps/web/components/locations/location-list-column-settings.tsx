"use client";

import { ListModuleTableColumnSettings } from "@/components/list-columns/list-module-table-column-settings";
import {
  LOCATION_LIST_COLUMN_IDS,
  LOCATION_LIST_COLUMN_REGISTRY,
  type LocationListColumnId,
} from "@/lib/locations/list-columns";
import {
  getLocationColumnPrefsSlice,
  setLocationColumnPrefsSlice,
  setLocationColumnPrefsSliceAllDevices,
  type LocationListPrefs,
} from "@/lib/locations/list-prefs";
import type { DeviceClass } from "@/lib/layout/device-class";

type Props = {
  prefs: LocationListPrefs;
  onChange: (prefs: LocationListPrefs) => void;
  detectedDeviceClass?: DeviceClass;
  disabled?: boolean;
  triggerClassName?: string;
};

export function LocationListColumnSettings({
  prefs,
  onChange,
  detectedDeviceClass = "desktop",
  disabled = false,
  triggerClassName,
}: Props) {
  return (
    <ListModuleTableColumnSettings
      registry={LOCATION_LIST_COLUMN_REGISTRY}
      detectedDeviceClass={detectedDeviceClass}
      allowedColumnIds={LOCATION_LIST_COLUMN_IDS}
      resolveColumnPrefs={(device) =>
        getLocationColumnPrefsSlice(prefs, device as DeviceClass)
      }
      commitColumnPrefs={(device, columnPrefs) =>
        onChange(setLocationColumnPrefsSlice(prefs, device as DeviceClass, columnPrefs))
      }
      commitColumnPrefsAllDevices={(columnPrefs) =>
        onChange(setLocationColumnPrefsSliceAllDevices(prefs, columnPrefs))
      }
      disabled={disabled}
      triggerClassName={triggerClassName}
      triggerVariant="outline"
    />
  );
}

export function getLocationChipDisplay(
  prefs: LocationListPrefs,
  deviceClass: DeviceClass = "desktop"
): Partial<Record<LocationListColumnId, import("@/lib/list-columns/types").ColumnChipDisplay>> {
  return getLocationColumnPrefsSlice(prefs, deviceClass).columnChipDisplay ?? {};
}
