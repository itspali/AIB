"use client";

import { ListModuleTableColumnSettings } from "@/components/list-columns/list-module-table-column-settings";
import { INVOICE_LIST_COLUMN_REGISTRY } from "@/lib/sales/invoices/list-columns";
import {
  getSalesInvoiceColumnPrefsSlice,
  setSalesInvoiceColumnPrefsSlice,
  setSalesInvoiceColumnPrefsSliceAllDevices,
  type SalesInvoiceListPrefs,
} from "@/lib/sales/invoices/list-prefs";
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
  return (
    <ListModuleTableColumnSettings
      registry={INVOICE_LIST_COLUMN_REGISTRY}
      detectedDeviceClass={detectedDeviceClass}
      resolveColumnPrefs={(device) =>
        getSalesInvoiceColumnPrefsSlice(prefs, device as DeviceClass)
      }
      commitColumnPrefs={(device, columnPrefs) =>
        onChange(setSalesInvoiceColumnPrefsSlice(prefs, device as DeviceClass, columnPrefs))
      }
      commitColumnPrefsAllDevices={(columnPrefs) =>
        onChange(setSalesInvoiceColumnPrefsSliceAllDevices(prefs, columnPrefs))
      }
      frozenColumnCount={prefs.frozenColumnCount}
      onFrozenColumnCountChange={(frozenColumnCount) =>
        onChange({ ...prefs, frozenColumnCount })
      }
      disabled={disabled}
    />
  );
}
