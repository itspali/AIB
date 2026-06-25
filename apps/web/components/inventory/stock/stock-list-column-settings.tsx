"use client";

import { ListModuleTableColumnSettings } from "@/components/list-columns/list-module-table-column-settings";
import {
  getStockColumnPrefs,
  getStockColumnRegistry,
  setStockBalanceColumnPrefsSlice,
  setStockBalanceColumnPrefsSliceAllDevices,
  setStockAdjustmentColumnPrefsSlice,
  setStockAdjustmentColumnPrefsSliceAllDevices,
  type StockListPrefs,
} from "@/lib/inventory/stock/list-prefs";
import type { DeviceClass } from "@/lib/layout/device-class";
import type { ListColumnPrefs } from "@/lib/list-columns/types";
import type { StockAdjustmentColumnId, StockBalanceColumnId } from "@/lib/inventory/stock/list-columns";

type Props = {
  prefs: StockListPrefs;
  onChange: (prefs: StockListPrefs) => void;
  detectedDeviceClass: DeviceClass;
  disabled?: boolean;
};

export function StockListColumnSettings({
  prefs,
  onChange,
  detectedDeviceClass,
  disabled = false,
}: Props) {
  const registry = getStockColumnRegistry(prefs);
  const isAdjustments = prefs.viewMode === "adjustments";

  return (
    <ListModuleTableColumnSettings
      registry={registry}
      detectedDeviceClass={detectedDeviceClass}
      resolveColumnPrefs={(device) =>
        getStockColumnPrefs(prefs, device as DeviceClass)
      }
      commitColumnPrefs={(device, columnPrefs) =>
        onChange(
          isAdjustments
            ? setStockAdjustmentColumnPrefsSlice(
                prefs,
                device as DeviceClass,
                columnPrefs as ListColumnPrefs<StockAdjustmentColumnId>
              )
            : setStockBalanceColumnPrefsSlice(
                prefs,
                device as DeviceClass,
                columnPrefs as ListColumnPrefs<StockBalanceColumnId>
              )
        )
      }
      commitColumnPrefsAllDevices={(columnPrefs) =>
        onChange(
          isAdjustments
            ? setStockAdjustmentColumnPrefsSliceAllDevices(
                prefs,
                columnPrefs as ListColumnPrefs<StockAdjustmentColumnId>
              )
            : setStockBalanceColumnPrefsSliceAllDevices(
                prefs,
                columnPrefs as ListColumnPrefs<StockBalanceColumnId>
              )
        )
      }
      frozenColumnCount={prefs.frozenColumnCount}
      onFrozenColumnCountChange={(frozenColumnCount) =>
        onChange({ ...prefs, frozenColumnCount })
      }
      disabled={disabled}
    />
  );
}
