"use client";

import { ListModuleTableColumnSettings } from "@/components/list-columns/list-module-table-column-settings";
import { CATEGORY_LIST_COLUMN_REGISTRY } from "@/lib/categories/list-columns";
import { CATEGORIES_WORKSPACE_DISABLED_COLUMNS } from "@/lib/categories/category-row-meta";
import {
  getColumnPrefsSlice,
  setColumnPrefsSlice,
  setColumnPrefsSliceAllDevices,
  type CategoryListPrefs,
  type DeviceClass,
} from "@/lib/categories/list-prefs";
import type { ListWorkspaceLayout } from "@/lib/layout/list-workspace";

type Props = {
  prefs: CategoryListPrefs;
  onChange: (prefs: CategoryListPrefs) => void;
  detectedDeviceClass: DeviceClass;
  disabled?: boolean;
  isSaving?: boolean;
  triggerClassName?: string;
  triggerVariant?: "outline" | "ghost";
  workspaceLayout?: ListWorkspaceLayout;
};

export function CategoryListColumnSettings({
  prefs,
  onChange,
  detectedDeviceClass,
  disabled = false,
  isSaving = false,
  triggerClassName,
  triggerVariant,
  workspaceLayout,
}: Props) {
  return (
    <ListModuleTableColumnSettings
      registry={CATEGORY_LIST_COLUMN_REGISTRY}
      detectedDeviceClass={detectedDeviceClass}
      resolveColumnPrefs={(device) => getColumnPrefsSlice(prefs, device as DeviceClass)}
      commitColumnPrefs={(device, columnPrefs) =>
        onChange(setColumnPrefsSlice(prefs, device as DeviceClass, columnPrefs))
      }
      commitColumnPrefsAllDevices={(columnPrefs) =>
        onChange(setColumnPrefsSliceAllDevices(prefs, columnPrefs))
      }
      workspaceLayout={workspaceLayout}
      frozenColumnCount={prefs.frozenColumnCount}
      onFrozenColumnCountChange={(frozenColumnCount) =>
        onChange({ ...prefs, frozenColumnCount })
      }
      disabledColumnIds={CATEGORIES_WORKSPACE_DISABLED_COLUMNS}
      disabled={disabled}
      isSaving={isSaving}
      triggerClassName={triggerClassName}
      triggerVariant={triggerVariant}
    />
  );
}
