"use client";

import { ListModuleTableColumnSettings } from "@/components/list-columns/list-module-table-column-settings";
import { TRANSFER_LIST_COLUMN_REGISTRY } from "@/lib/inventory/transfers/list-columns";
import {
  getTransferColumnPrefsSlice,
  setTransferColumnPrefsSlice,
  setTransferColumnPrefsSliceAllDevices,
  type TransferListPrefs,
} from "@/lib/inventory/transfers/list-prefs";
import type { DeviceClass } from "@/lib/layout/device-class";

type Props = {
  prefs: TransferListPrefs;
  onChange: (prefs: TransferListPrefs) => void;
  detectedDeviceClass: DeviceClass;
  disabled?: boolean;
};

export function TransferListColumnSettings({
  prefs,
  onChange,
  detectedDeviceClass,
  disabled = false,
}: Props) {
  return (
    <ListModuleTableColumnSettings
      registry={TRANSFER_LIST_COLUMN_REGISTRY}
      detectedDeviceClass={detectedDeviceClass}
      resolveColumnPrefs={(device) =>
        getTransferColumnPrefsSlice(prefs, device as DeviceClass)
      }
      commitColumnPrefs={(device, columnPrefs) =>
        onChange(setTransferColumnPrefsSlice(prefs, device as DeviceClass, columnPrefs))
      }
      commitColumnPrefsAllDevices={(columnPrefs) =>
        onChange(setTransferColumnPrefsSliceAllDevices(prefs, columnPrefs))
      }
      frozenColumnCount={prefs.frozenColumnCount}
      onFrozenColumnCountChange={(frozenColumnCount) =>
        onChange({ ...prefs, frozenColumnCount })
      }
      disabled={disabled}
    />
  );
}
