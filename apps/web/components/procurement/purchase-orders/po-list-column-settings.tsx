"use client";

import { useEffect, useState } from "react";
import {
  ListColumnSettings,
  type ColumnSettingsDevice,
} from "@/components/list-columns/list-column-settings";
import { PO_LIST_COLUMN_REGISTRY } from "@/lib/procurement/purchase-orders/list-columns";
import type { PurchaseOrderListPrefs } from "@/lib/procurement/purchase-orders/list-prefs";
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
  const [editingDevice, setEditingDevice] = useState<ColumnSettingsDevice>(detectedDeviceClass);

  useEffect(() => {
    setEditingDevice(detectedDeviceClass);
  }, [detectedDeviceClass]);

  return (
    <ListColumnSettings
      registry={PO_LIST_COLUMN_REGISTRY}
      prefs={prefs.columnPrefs}
      allowedColumnIds={PO_LIST_COLUMN_REGISTRY.ids}
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
