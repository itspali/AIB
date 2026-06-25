"use client";

import {
  ListColumnSettings,
  type ColumnSettingsDevice,
} from "@/components/list-columns/list-column-settings";
import {
  LIST_MODULE_COLUMN_SETTINGS_CHROME,
  resolveColumnSettingsDeviceSwitcher,
  useColumnSettingsEditingDevice,
} from "@/lib/list-columns/list-module-column-settings";
import { useOptionalListWorkspace } from "@/lib/layout/list-workspace";
import type { ListColumnPrefs, ListColumnRegistry } from "@/lib/list-columns/types";
import type { DeviceClass } from "@/lib/layout/device-class";
import type { ListWorkspaceLayout } from "@/lib/layout/list-workspace";
import type { FrozenColumnPref } from "@/lib/products/list-prefs";

type Props<TId extends string> = {
  registry: ListColumnRegistry<TId>;
  detectedDeviceClass: DeviceClass;
  allowedColumnIds?: readonly TId[];
  frozenColumnCount?: FrozenColumnPref;
  onFrozenColumnCountChange?: (count: FrozenColumnPref) => void;
  /** Flat prefs — one column set shared across screens (operational list modules). */
  columnPrefs?: ListColumnPrefs<TId>;
  onColumnPrefsChange?: (columnPrefs: ListColumnPrefs<TId>) => void;
  /** Device-scoped prefs — matrix workspace modules. */
  resolveColumnPrefs?: (device: ColumnSettingsDevice) => ListColumnPrefs<TId>;
  commitColumnPrefs?: (device: ColumnSettingsDevice, columnPrefs: ListColumnPrefs<TId>) => void;
  commitColumnPrefsAllDevices?: (columnPrefs: ListColumnPrefs<TId>) => void;
  showDeviceSwitcher?: boolean;
  workspaceLayout?: ListWorkspaceLayout;
  lockedColumnIds?: readonly TId[];
  lockedColumnReason?: string;
  disabledColumnIds?: readonly TId[];
  disabledColumnReason?: string;
  disabled?: boolean;
  isSaving?: boolean;
  triggerClassName?: string;
  triggerVariant?: "outline" | "ghost";
};

export function ListModuleTableColumnSettings<TId extends string>({
  registry,
  detectedDeviceClass,
  allowedColumnIds,
  frozenColumnCount,
  onFrozenColumnCountChange,
  columnPrefs,
  onColumnPrefsChange,
  resolveColumnPrefs,
  commitColumnPrefs,
  commitColumnPrefsAllDevices,
  showDeviceSwitcher,
  workspaceLayout,
  lockedColumnIds,
  lockedColumnReason,
  disabledColumnIds,
  disabledColumnReason,
  disabled = false,
  isSaving = false,
  triggerClassName,
  triggerVariant,
}: Props<TId>) {
  const workspace = useOptionalListWorkspace();
  const resolvedWorkspaceLayout = workspaceLayout ?? workspace?.layout;
  const [editingDevice, setEditingDevice] = useColumnSettingsEditingDevice(detectedDeviceClass);
  const isSplitWorkspace = resolvedWorkspaceLayout === "split";
  const deviceSwitcherVisible = resolveColumnSettingsDeviceSwitcher(
    resolvedWorkspaceLayout,
    showDeviceSwitcher
  );
  const activeColumnPrefs = resolveColumnPrefs
    ? resolveColumnPrefs(editingDevice)
    : columnPrefs!;

  return (
    <ListColumnSettings
      registry={registry}
      prefs={activeColumnPrefs}
      allowedColumnIds={allowedColumnIds ?? registry.ids}
      editingLayout="table"
      editingDevice={editingDevice}
      detectedDevice={detectedDeviceClass}
      onEditingLayoutChange={() => {}}
      onEditingDeviceChange={setEditingDevice}
      onChange={(nextPrefs) => {
        if (isSplitWorkspace && commitColumnPrefsAllDevices) {
          commitColumnPrefsAllDevices(nextPrefs);
          return;
        }
        if (commitColumnPrefs) {
          commitColumnPrefs(editingDevice, nextPrefs);
          return;
        }
        onColumnPrefsChange?.(nextPrefs);
      }}
      frozenColumnCount={isSplitWorkspace ? undefined : frozenColumnCount}
      onFrozenColumnCountChange={
        isSplitWorkspace ? undefined : onFrozenColumnCountChange
      }
      showDeviceSwitcher={deviceSwitcherVisible}
      lockedColumnIds={lockedColumnIds}
      lockedColumnReason={lockedColumnReason}
      disabledColumnIds={disabledColumnIds}
      disabledColumnReason={disabledColumnReason}
      disabled={disabled}
      isSaving={isSaving}
      triggerClassName={triggerClassName}
      triggerVariant={triggerVariant}
      {...LIST_MODULE_COLUMN_SETTINGS_CHROME}
    />
  );
}

export type { ColumnSettingsDevice };
