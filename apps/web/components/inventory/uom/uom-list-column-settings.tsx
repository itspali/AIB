"use client";

import { ListModuleTableColumnSettings } from "@/components/list-columns/list-module-table-column-settings";
import { UOM_LIST_COLUMN_REGISTRY } from "@/lib/uom/list-columns";
import {
  getUomColumnPrefsSlice,
  setUomColumnPrefsSlice,
  setUomColumnPrefsSliceAllDevices,
  type UomListPrefs,
} from "@/lib/uom/list-prefs";
import type { DeviceClass } from "@/lib/layout/device-class";

type Props = {
  prefs: UomListPrefs;
  onChange: (prefs: UomListPrefs) => void;
  detectedDeviceClass: DeviceClass;
  disabled?: boolean;
};

export function UomListColumnSettings({
  prefs,
  onChange,
  detectedDeviceClass,
  disabled = false,
}: Props) {
  return (
    <ListModuleTableColumnSettings
      registry={UOM_LIST_COLUMN_REGISTRY}
      detectedDeviceClass={detectedDeviceClass}
      resolveColumnPrefs={(device) =>
        getUomColumnPrefsSlice(prefs, device as DeviceClass)
      }
      commitColumnPrefs={(device, columnPrefs) =>
        onChange(setUomColumnPrefsSlice(prefs, device as DeviceClass, columnPrefs))
      }
      commitColumnPrefsAllDevices={(columnPrefs) =>
        onChange(setUomColumnPrefsSliceAllDevices(prefs, columnPrefs))
      }
      frozenColumnCount={prefs.frozenColumnCount}
      onFrozenColumnCountChange={(frozenColumnCount) =>
        onChange({ ...prefs, frozenColumnCount })
      }
      disabled={disabled}
    />
  );
}
