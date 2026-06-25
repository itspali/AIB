"use client";

import { ListModuleTableColumnSettings } from "@/components/list-columns/list-module-table-column-settings";
import { BILL_LIST_COLUMN_REGISTRY } from "@/lib/procurement/bills/list-columns";
import {
  getPurchaseBillColumnPrefsSlice,
  setPurchaseBillColumnPrefsSlice,
  setPurchaseBillColumnPrefsSliceAllDevices,
  type PurchaseBillListPrefs,
} from "@/lib/procurement/bills/list-prefs";
import type { DeviceClass } from "@/lib/layout/device-class";

type Props = {
  prefs: PurchaseBillListPrefs;
  onChange: (prefs: PurchaseBillListPrefs) => void;
  detectedDeviceClass: DeviceClass;
  disabled?: boolean;
};

export function BillListColumnSettings({
  prefs,
  onChange,
  detectedDeviceClass,
  disabled = false,
}: Props) {
  return (
    <ListModuleTableColumnSettings
      registry={BILL_LIST_COLUMN_REGISTRY}
      detectedDeviceClass={detectedDeviceClass}
      resolveColumnPrefs={(device) =>
        getPurchaseBillColumnPrefsSlice(prefs, device as DeviceClass)
      }
      commitColumnPrefs={(device, columnPrefs) =>
        onChange(setPurchaseBillColumnPrefsSlice(prefs, device as DeviceClass, columnPrefs))
      }
      commitColumnPrefsAllDevices={(columnPrefs) =>
        onChange(setPurchaseBillColumnPrefsSliceAllDevices(prefs, columnPrefs))
      }
      frozenColumnCount={prefs.frozenColumnCount}
      onFrozenColumnCountChange={(frozenColumnCount) =>
        onChange({ ...prefs, frozenColumnCount })
      }
      disabled={disabled}
    />
  );
}
