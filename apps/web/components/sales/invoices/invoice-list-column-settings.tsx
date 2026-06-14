"use client";

import { useEffect, useState } from "react";
import {
  ListColumnSettings,
  type ColumnSettingsDevice,
} from "@/components/list-columns/list-column-settings";
import { INVOICE_LIST_COLUMN_REGISTRY } from "@/lib/sales/invoices/list-columns";
import type { SalesInvoiceListPrefs } from "@/lib/sales/invoices/list-prefs";
import type { DeviceClass } from "@/lib/layout/device-class";

type Props = {
  prefs: SalesInvoiceListPrefs;
  onChange: (prefs: SalesInvoiceListPrefs) => void;
  detectedDeviceClass: DeviceClass;
  disabled?: boolean;
};

export function InvoiceListColumnSettings({
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
      registry={INVOICE_LIST_COLUMN_REGISTRY}
      prefs={prefs.columnPrefs}
      allowedColumnIds={INVOICE_LIST_COLUMN_REGISTRY.ids}
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
