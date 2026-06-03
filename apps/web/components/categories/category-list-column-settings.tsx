"use client";

import { useEffect, useState } from "react";
import {
  ListColumnSettings,
  type ColumnSettingsDevice,
  type ColumnSettingsLayout,
} from "@/components/list-columns/list-column-settings";
import { CATEGORY_LIST_COLUMN_REGISTRY } from "@/lib/categories/list-columns";
import {
  getColumnPrefsSlice,
  setColumnPrefsSlice,
  type CategoryListPrefs,
  type CategoryTableViewMode,
  type DeviceClass,
} from "@/lib/categories/list-prefs";

type Props = {
  prefs: CategoryListPrefs;
  onChange: (prefs: CategoryListPrefs) => void;
  detectedDeviceClass: DeviceClass;
  disabled?: boolean;
  isSaving?: boolean;
  triggerClassName?: string;
  triggerVariant?: "outline" | "ghost";
};

export function CategoryListColumnSettings({
  prefs,
  onChange,
  detectedDeviceClass,
  disabled = false,
  isSaving = false,
  triggerClassName,
  triggerVariant,
}: Props) {
  const tableViewMode: CategoryTableViewMode =
    prefs.viewMode === "compact" ? "compact" : "table";

  const [editingLayout, setEditingLayout] = useState<ColumnSettingsLayout>(tableViewMode);
  const [editingDevice, setEditingDevice] = useState<ColumnSettingsDevice>(detectedDeviceClass);

  useEffect(() => {
    setEditingLayout(tableViewMode);
  }, [tableViewMode]);

  useEffect(() => {
    setEditingDevice(detectedDeviceClass);
  }, [detectedDeviceClass]);

  const slice = getColumnPrefsSlice(
    prefs,
    editingLayout as CategoryTableViewMode,
    editingDevice as DeviceClass
  );

  return (
    <ListColumnSettings
      registry={CATEGORY_LIST_COLUMN_REGISTRY}
      prefs={slice}
      allowedColumnIds={CATEGORY_LIST_COLUMN_REGISTRY.ids}
      editingLayout={editingLayout}
      editingDevice={editingDevice}
      detectedDevice={detectedDeviceClass}
      onEditingLayoutChange={setEditingLayout}
      onEditingDeviceChange={setEditingDevice}
      onChange={(columnPrefs) =>
        onChange(
          setColumnPrefsSlice(
            prefs,
            editingLayout as CategoryTableViewMode,
            editingDevice as DeviceClass,
            columnPrefs
          )
        )
      }
      frozenColumnCount={prefs.frozenColumnCount}
      onFrozenColumnCountChange={(frozenColumnCount) =>
        onChange({ ...prefs, frozenColumnCount })
      }
      disabled={disabled}
      isSaving={isSaving}
      triggerClassName={triggerClassName}
      triggerVariant={triggerVariant}
    />
  );
}
