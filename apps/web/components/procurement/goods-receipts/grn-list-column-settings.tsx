"use client";

import { ListModuleTableColumnSettings } from "@/components/list-columns/list-module-table-column-settings";
import { GRN_LIST_COLUMN_REGISTRY } from "@/lib/procurement/goods-receipts/list-columns";
import {
  getGoodsReceiptColumnPrefsSlice,
  setGoodsReceiptColumnPrefsSlice,
  setGoodsReceiptColumnPrefsSliceAllDevices,
  type GoodsReceiptListPrefs,
} from "@/lib/procurement/goods-receipts/list-prefs";
import type { DeviceClass } from "@/lib/layout/device-class";

type Props = {
  prefs: GoodsReceiptListPrefs;
  onChange: (prefs: GoodsReceiptListPrefs) => void;
  detectedDeviceClass: DeviceClass;
  disabled?: boolean;
};

export function GrnListColumnSettings({
  prefs,
  onChange,
  detectedDeviceClass,
  disabled = false,
}: Props) {
  return (
    <ListModuleTableColumnSettings
      registry={GRN_LIST_COLUMN_REGISTRY}
      detectedDeviceClass={detectedDeviceClass}
      resolveColumnPrefs={(device) =>
        getGoodsReceiptColumnPrefsSlice(prefs, device as DeviceClass)
      }
      commitColumnPrefs={(device, columnPrefs) =>
        onChange(setGoodsReceiptColumnPrefsSlice(prefs, device as DeviceClass, columnPrefs))
      }
      commitColumnPrefsAllDevices={(columnPrefs) =>
        onChange(setGoodsReceiptColumnPrefsSliceAllDevices(prefs, columnPrefs))
      }
      frozenColumnCount={prefs.frozenColumnCount}
      onFrozenColumnCountChange={(frozenColumnCount) =>
        onChange({ ...prefs, frozenColumnCount })
      }
      disabled={disabled}
    />
  );
}
