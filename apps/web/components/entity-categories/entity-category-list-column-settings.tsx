"use client";

import { useEffect, useState } from "react";
import {
  ListColumnSettings,
  type ColumnSettingsDevice,
  type ColumnSettingsLayout,
} from "@/components/list-columns/list-column-settings";
import { getEntityCategoryListColumnRegistry } from "@/lib/entity-categories/list-columns";
import {
  getColumnPrefsSlice,
  setColumnPrefsSlice,
  type EntityCategoryListPrefs,
  type EntityCategoryTableViewMode,
  type DeviceClass,
} from "@/lib/entity-categories/list-prefs";
import type { EntityCategoryWorkspace } from "@/lib/entity-categories/types";

type Props = {
  workspace: EntityCategoryWorkspace;
  prefs: EntityCategoryListPrefs;
  onChange: (prefs: EntityCategoryListPrefs) => void;
  detectedDeviceClass: DeviceClass;
  disabled?: boolean;
  isSaving?: boolean;
  triggerClassName?: string;
  triggerVariant?: "outline" | "ghost";
};

export function EntityCategoryListColumnSettings({
  workspace,
  prefs,
  onChange,
  detectedDeviceClass,
  disabled = false,
  isSaving = false,
  triggerClassName,
  triggerVariant,
}: Props) {
  const registry = getEntityCategoryListColumnRegistry(workspace);
  const tableViewMode: EntityCategoryTableViewMode =
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
    editingLayout as EntityCategoryTableViewMode,
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
            editingLayout as EntityCategoryTableViewMode,
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
