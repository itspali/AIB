"use client";

import { ListModuleTableColumnSettings } from "@/components/list-columns/list-module-table-column-settings";
import { SO_LIST_COLUMN_REGISTRY } from "@/lib/sales/orders/list-columns";
import {
  getSalesOrderColumnPrefsSlice,
  setSalesOrderColumnPrefsSlice,
  setSalesOrderColumnPrefsSliceAllDevices,
  type SalesOrderListPrefs,
} from "@/lib/sales/orders/list-prefs";
import type { DeviceClass } from "@/lib/layout/device-class";

type Props = {
  prefs: SalesOrderListPrefs;
  onChange: (prefs: SalesOrderListPrefs) => void;
  detectedDeviceClass: DeviceClass;
  disabled?: boolean;
};

export function SoListColumnSettings({
  prefs,
  onChange,
  detectedDeviceClass,
  disabled = false,
}: Props) {
  return (
    <ListModuleTableColumnSettings
      registry={SO_LIST_COLUMN_REGISTRY}
      detectedDeviceClass={detectedDeviceClass}
      resolveColumnPrefs={(device) =>
        getSalesOrderColumnPrefsSlice(prefs, device as DeviceClass)
      }
      commitColumnPrefs={(device, columnPrefs) =>
        onChange(setSalesOrderColumnPrefsSlice(prefs, device as DeviceClass, columnPrefs))
      }
      commitColumnPrefsAllDevices={(columnPrefs) =>
        onChange(setSalesOrderColumnPrefsSliceAllDevices(prefs, columnPrefs))
      }
      frozenColumnCount={prefs.frozenColumnCount}
      onFrozenColumnCountChange={(frozenColumnCount) =>
        onChange({ ...prefs, frozenColumnCount })
      }
      disabled={disabled}
    />
  );
}
