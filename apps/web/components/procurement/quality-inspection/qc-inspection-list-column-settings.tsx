"use client";

import { ListModuleTableColumnSettings } from "@/components/list-columns/list-module-table-column-settings";
import { QC_QUEUE_LIST_COLUMN_REGISTRY } from "@/lib/procurement/quality-inspection/list-columns";
import {
  getQcQueueColumnPrefsSlice,
  setQcQueueColumnPrefsSlice,
  setQcQueueColumnPrefsSliceAllDevices,
  type QcQueueListPrefs,
} from "@/lib/procurement/quality-inspection/list-prefs";
import type { DeviceClass } from "@/lib/layout/device-class";

type Props = {
  prefs: QcQueueListPrefs;
  onChange: (prefs: QcQueueListPrefs) => void;
  detectedDeviceClass: DeviceClass;
  disabled?: boolean;
};

export function QcInspectionListColumnSettings({
  prefs,
  onChange,
  detectedDeviceClass,
  disabled = false,
}: Props) {
  return (
    <ListModuleTableColumnSettings
      registry={QC_QUEUE_LIST_COLUMN_REGISTRY}
      detectedDeviceClass={detectedDeviceClass}
      resolveColumnPrefs={(device) =>
        getQcQueueColumnPrefsSlice(prefs, device as DeviceClass)
      }
      commitColumnPrefs={(device, columnPrefs) =>
        onChange(setQcQueueColumnPrefsSlice(prefs, device as DeviceClass, columnPrefs))
      }
      commitColumnPrefsAllDevices={(columnPrefs) =>
        onChange(setQcQueueColumnPrefsSliceAllDevices(prefs, columnPrefs))
      }
      frozenColumnCount={prefs.frozenColumnCount}
      onFrozenColumnCountChange={(frozenColumnCount) =>
        onChange({ ...prefs, frozenColumnCount })
      }
      disabled={disabled}
    />
  );
}
