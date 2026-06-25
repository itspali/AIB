"use client";

import { ListModuleTableColumnSettings } from "@/components/list-columns/list-module-table-column-settings";
import { TAX_LIST_COLUMN_REGISTRY } from "@/lib/tax/list-columns";
import {
  getTaxColumnPrefsSlice,
  setTaxColumnPrefsSlice,
  setTaxColumnPrefsSliceAllDevices,
  type TaxListPrefs,
} from "@/lib/tax/list-prefs";
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
  return (
    <ListModuleTableColumnSettings
      registry={TAX_LIST_COLUMN_REGISTRY}
      detectedDeviceClass={detectedDeviceClass}
      resolveColumnPrefs={(device) =>
        getTaxColumnPrefsSlice(prefs, device as DeviceClass)
      }
      commitColumnPrefs={(device, columnPrefs) =>
        onChange(setTaxColumnPrefsSlice(prefs, device as DeviceClass, columnPrefs))
      }
      commitColumnPrefsAllDevices={(columnPrefs) =>
        onChange(setTaxColumnPrefsSliceAllDevices(prefs, columnPrefs))
      }
      frozenColumnCount={prefs.frozenColumnCount}
      onFrozenColumnCountChange={(frozenColumnCount) =>
        onChange({ ...prefs, frozenColumnCount })
      }
      disabled={disabled}
    />
  );
}
