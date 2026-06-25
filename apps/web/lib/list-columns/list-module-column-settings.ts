"use client";

import { useEffect, useState } from "react";
import type { ColumnSettingsDevice } from "@/components/list-columns/list-column-settings";
import type { DeviceClass } from "@/lib/layout/device-class";
import type { ListWorkspaceLayout } from "@/lib/layout/list-workspace";

/** Shared panel chrome for list-module column selectors (Items/Categories master). */
export const LIST_MODULE_COLUMN_SETTINGS_CHROME = {
  showLayoutSwitcher: false,
  hideCardVariantControls: true,
} as const;

/** Tracks the screen breakpoint being edited in the column selector. */
export function useColumnSettingsEditingDevice(
  detectedDeviceClass: DeviceClass
): [ColumnSettingsDevice, (device: ColumnSettingsDevice) => void] {
  const [editingDevice, setEditingDevice] = useState<ColumnSettingsDevice>(detectedDeviceClass);

  useEffect(() => {
    setEditingDevice(detectedDeviceClass);
  }, [detectedDeviceClass]);

  return [editingDevice, setEditingDevice];
}

/** Matrix shows per-screen columns; split uses unified prefs without a screen picker. */
export function resolveColumnSettingsDeviceSwitcher(
  workspaceLayout?: ListWorkspaceLayout,
  override?: boolean
): boolean {
  if (override !== undefined) return override;
  return workspaceLayout !== "split";
}

export function isSplitWorkspaceLayout(workspaceLayout?: ListWorkspaceLayout): boolean {
  return workspaceLayout === "split";
}
