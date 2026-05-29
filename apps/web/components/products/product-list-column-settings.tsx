"use client";

import { useEffect, useState } from "react";
import {
  ListColumnSettings,
  type ColumnSettingsDevice,
  type ColumnSettingsLayout,
} from "@/components/list-columns/list-column-settings";
import type { ProductFieldPermissions } from "@/lib/products/field-permissions";
import { PRODUCT_LIST_COLUMN_REGISTRY } from "@/lib/products/list-columns";
import {
  getColumnPrefsSlice,
  resolveCardGridColumns,
  setCardGridColumnsSlice,
  setColumnPrefsSlice,
  type DeviceClass,
  type ProductListPrefs,
  type ProductListViewMode,
} from "@/lib/products/list-prefs";

type Props = {
  prefs: ProductListPrefs;
  onChange: (prefs: ProductListPrefs) => void;
  fieldPermissions: ProductFieldPermissions;
  detectedDeviceClass: DeviceClass;
};

export function ProductListColumnSettings({
  prefs,
  onChange,
  fieldPermissions,
  detectedDeviceClass,
}: Props) {
  const [editingLayout, setEditingLayout] = useState<ColumnSettingsLayout>(prefs.viewMode);
  const [editingDevice, setEditingDevice] = useState<ColumnSettingsDevice>(detectedDeviceClass);

  useEffect(() => {
    setEditingLayout(prefs.viewMode);
  }, [prefs.viewMode]);

  useEffect(() => {
    setEditingDevice(detectedDeviceClass);
  }, [detectedDeviceClass]);

  const slice = getColumnPrefsSlice(
    prefs,
    editingLayout as ProductListViewMode,
    editingDevice as DeviceClass
  );

  return (
    <ListColumnSettings
      registry={PRODUCT_LIST_COLUMN_REGISTRY}
      prefs={slice}
      allowedColumnIds={fieldPermissions.allowedFields}
      editingLayout={editingLayout}
      editingDevice={editingDevice}
      detectedDevice={detectedDeviceClass}
      onEditingLayoutChange={setEditingLayout}
      onEditingDeviceChange={setEditingDevice}
      onChange={(columnPrefs) =>
        onChange(
          setColumnPrefsSlice(
            prefs,
            editingLayout as ProductListViewMode,
            editingDevice as DeviceClass,
            columnPrefs
          )
        )
      }
      showFreezeControl={prefs.viewMode === "table"}
      frozenColumnCount={prefs.frozenColumnCount}
      onFrozenColumnCountChange={(frozenColumnCount) =>
        onChange({ ...prefs, frozenColumnCount })
      }
      cardGridColumns={resolveCardGridColumns(prefs, editingDevice as DeviceClass)}
      onCardGridColumnsChange={(columns) =>
        onChange(setCardGridColumnsSlice(prefs, editingDevice as DeviceClass, columns))
      }
    />
  );
}
