"use client";

import { useEffect, useState } from "react";
import {
  ListColumnSettings,
  type ColumnSettingsLayout,
} from "@/components/list-columns/list-column-settings";
import {
  LIST_MODULE_COLUMN_SETTINGS_CHROME,
  resolveColumnSettingsDeviceSwitcher,
  useColumnSettingsEditingDevice,
} from "@/lib/list-columns/list-module-column-settings";
import { useOptionalListWorkspace } from "@/lib/layout/list-workspace";
import {
  getEntityListColumnRegistry,
  type EntityListColumnRegistryKey,
} from "@/lib/entities/list-columns";
import {
  getColumnPrefsSlice,
  setColumnPrefsSlice,
  type DeviceClass,
  type EntityListPrefs,
  type EntityListViewMode,
} from "@/lib/entities/list-prefs";

type Props = {
  registryKey: EntityListColumnRegistryKey;
  prefs: EntityListPrefs;
  onChange: (prefs: EntityListPrefs) => void;
  detectedDeviceClass: DeviceClass;
  disabled?: boolean;
};

export function EntityListColumnSettings({
  registryKey,
  prefs,
  onChange,
  detectedDeviceClass,
  disabled = false,
}: Props) {
  const workspace = useOptionalListWorkspace();
  const tableViewMode: EntityListViewMode = prefs.viewMode === "compact" ? "compact" : "table";
  const registry = getEntityListColumnRegistry(registryKey);

  const [editingLayout, setEditingLayout] = useState<ColumnSettingsLayout>(tableViewMode);
  const [editingDevice, setEditingDevice] = useColumnSettingsEditingDevice(detectedDeviceClass);

  useEffect(() => {
    setEditingLayout(tableViewMode);
  }, [tableViewMode]);

  const slice = getColumnPrefsSlice(
    prefs,
    editingLayout as EntityListViewMode,
    editingDevice as DeviceClass
  );

  return (
    <ListColumnSettings
      registry={registry}
      prefs={slice}
      allowedColumnIds={registry.ids}
      editingLayout={editingLayout}
      editingDevice={editingDevice}
      detectedDevice={detectedDeviceClass}
      onEditingLayoutChange={setEditingLayout}
      onEditingDeviceChange={setEditingDevice}
      onChange={(columnPrefs) =>
        onChange(
          setColumnPrefsSlice(
            prefs,
            editingLayout as EntityListViewMode,
            editingDevice as DeviceClass,
            columnPrefs
          )
        )
      }
      frozenColumnCount={prefs.frozenColumnCount}
      onFrozenColumnCountChange={(frozenColumnCount) =>
        onChange({ ...prefs, frozenColumnCount })
      }
      showDeviceSwitcher={resolveColumnSettingsDeviceSwitcher(workspace?.layout)}
      disabled={disabled}
      {...LIST_MODULE_COLUMN_SETTINGS_CHROME}
    />
  );
}
