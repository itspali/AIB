"use client";

import { useEffect, useState } from "react";
import {
  ListColumnSettings,
  type ColumnSettingsDevice,
} from "@/components/list-columns/list-column-settings";
import { GRN_LIST_COLUMN_REGISTRY } from "@/lib/procurement/goods-receipts/list-columns";
import type { GoodsReceiptListPrefs } from "@/lib/procurement/goods-receipts/list-prefs";
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
  const [editingDevice, setEditingDevice] = useState<ColumnSettingsDevice>(detectedDeviceClass);

  useEffect(() => {
    setEditingDevice(detectedDeviceClass);
  }, [detectedDeviceClass]);

  return (
    <ListColumnSettings
      registry={GRN_LIST_COLUMN_REGISTRY}
      prefs={prefs.columnPrefs}
      allowedColumnIds={GRN_LIST_COLUMN_REGISTRY.ids}
      editingLayout="table"
      editingDevice={editingDevice}
      detectedDevice={detectedDeviceClass}
      onEditingLayoutChange={() => {}}
      onEditingDeviceChange={setEditingDevice}
      onChange={(columnPrefs) => onChange({ ...prefs, columnPrefs })}
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
