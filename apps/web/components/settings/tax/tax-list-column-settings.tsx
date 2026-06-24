"use client";

import { useEffect, useState } from "react";
import {
  ListColumnSettings,
  type ColumnSettingsDevice,
} from "@/components/list-columns/list-column-settings";
import { TAX_LIST_COLUMN_REGISTRY } from "@/lib/tax/list-columns";
import type { TaxListPrefs } from "@/lib/tax/list-prefs";
import type { DeviceClass } from "@/lib/layout/device-class";

type Props = {
  prefs: TaxListPrefs;
  onChange: (prefs: TaxListPrefs) => void;
  detectedDeviceClass: DeviceClass;
  disabled?: boolean;
};

export function TaxListColumnSettings({
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
      registry={TAX_LIST_COLUMN_REGISTRY}
      prefs={prefs.columnPrefs}
      allowedColumnIds={TAX_LIST_COLUMN_REGISTRY.ids}
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
