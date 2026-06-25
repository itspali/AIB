"use client";

import { ListModuleTableColumnSettings } from "@/components/list-columns/list-module-table-column-settings";
import { PO_LIST_COLUMN_REGISTRY } from "@/lib/procurement/purchase-orders/list-columns";
import {
  getPurchaseOrderColumnPrefsSlice,
  setPurchaseOrderColumnPrefsSlice,
  setPurchaseOrderColumnPrefsSliceAllDevices,
  type PurchaseOrderListPrefs,
} from "@/lib/procurement/purchase-orders/list-prefs";
import type { DeviceClass } from "@/lib/layout/device-class";

type Props = {
  prefs: PurchaseOrderListPrefs;
  onChange: (prefs: PurchaseOrderListPrefs) => void;
  detectedDeviceClass: DeviceClass;
  disabled?: boolean;
};

export function PoListColumnSettings({
  prefs,
  onChange,
  detectedDeviceClass,
  disabled = false,
}: Props) {
  return (
    <ListModuleTableColumnSettings
      registry={PO_LIST_COLUMN_REGISTRY}
      detectedDeviceClass={detectedDeviceClass}
      resolveColumnPrefs={(device) =>
        getPurchaseOrderColumnPrefsSlice(prefs, device as DeviceClass)
      }
      commitColumnPrefs={(device, columnPrefs) =>
        onChange(setPurchaseOrderColumnPrefsSlice(prefs, device as DeviceClass, columnPrefs))
      }
      commitColumnPrefsAllDevices={(columnPrefs) =>
        onChange(setPurchaseOrderColumnPrefsSliceAllDevices(prefs, columnPrefs))
      }
      frozenColumnCount={prefs.frozenColumnCount}
      onFrozenColumnCountChange={(frozenColumnCount) =>
        onChange({ ...prefs, frozenColumnCount })
      }
      disabled={disabled}
    />
  );
}
