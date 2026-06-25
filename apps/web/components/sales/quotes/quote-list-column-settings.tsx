"use client";

import { ListModuleTableColumnSettings } from "@/components/list-columns/list-module-table-column-settings";
import { QUOTE_LIST_COLUMN_REGISTRY } from "@/lib/sales/quotes/list-columns";
import {
  getSalesQuoteColumnPrefsSlice,
  setSalesQuoteColumnPrefsSlice,
  setSalesQuoteColumnPrefsSliceAllDevices,
  type SalesQuoteListPrefs,
} from "@/lib/sales/quotes/list-prefs";
import type { DeviceClass } from "@/lib/layout/device-class";

type Props = {
  prefs: SalesQuoteListPrefs;
  onChange: (prefs: SalesQuoteListPrefs) => void;
  detectedDeviceClass: DeviceClass;
  disabled?: boolean;
};

export function QuoteListColumnSettings({
  prefs,
  onChange,
  detectedDeviceClass,
  disabled = false,
}: Props) {
  return (
    <ListModuleTableColumnSettings
      registry={QUOTE_LIST_COLUMN_REGISTRY}
      detectedDeviceClass={detectedDeviceClass}
      resolveColumnPrefs={(device) =>
        getSalesQuoteColumnPrefsSlice(prefs, device as DeviceClass)
      }
      commitColumnPrefs={(device, columnPrefs) =>
        onChange(setSalesQuoteColumnPrefsSlice(prefs, device as DeviceClass, columnPrefs))
      }
      commitColumnPrefsAllDevices={(columnPrefs) =>
        onChange(setSalesQuoteColumnPrefsSliceAllDevices(prefs, columnPrefs))
      }
      frozenColumnCount={prefs.frozenColumnCount}
      onFrozenColumnCountChange={(frozenColumnCount) =>
        onChange({ ...prefs, frozenColumnCount })
      }
      disabled={disabled}
    />
  );
}
