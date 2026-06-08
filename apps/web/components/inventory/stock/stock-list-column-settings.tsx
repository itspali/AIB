"use client";

import { useEffect, useState } from "react";
import {
  ListColumnSettings,
  type ColumnSettingsDevice,
} from "@/components/list-columns/list-column-settings";
import {
  getStockColumnPrefs,
  getStockColumnRegistry,
  setStockColumnPrefs,
  type StockListPrefs,
} from "@/lib/inventory/stock/list-prefs";
import type { DeviceClass } from "@/lib/layout/device-class";

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
  const slice = getStockColumnPrefs(prefs);
  const [editingDevice, setEditingDevice] = useState<ColumnSettingsDevice>(detectedDeviceClass);

  useEffect(() => {
    setEditingDevice(detectedDeviceClass);
  }, [detectedDeviceClass]);

  return (
    <ListColumnSettings
      registry={registry}
      prefs={slice}
      allowedColumnIds={registry.ids}
      editingLayout="table"
      editingDevice={editingDevice}
      detectedDevice={detectedDeviceClass}
      onEditingLayoutChange={() => {}}
      onEditingDeviceChange={setEditingDevice}
      onChange={(columnPrefs) => onChange(setStockColumnPrefs(prefs, columnPrefs))}
      frozenColumnCount={prefs.frozenColumnCount}
      onFrozenColumnCountChange={(frozenColumnCount) =>
        onChange({ ...prefs, frozenColumnCount })
      }
      showLayoutSwitcher={false}
      showDeviceSwitcher={false}
      disabled={disabled}
    />
  );
}
