"use client";

import { useEffect, useState } from "react";
import {
  ListColumnSettings,
  type ColumnSettingsDevice,
  type ColumnSettingsLayout,
} from "@/components/list-columns/list-column-settings";
import type { ProductFieldPermissions } from "@/lib/products/field-permissions";
import {
  isProductCardColumnApplicable,
  productCardColumnDisabledReason,
} from "@/lib/products/card-column-applicability";
import { PRODUCT_LIST_COLUMN_REGISTRY, type ProductListColumnId } from "@/lib/products/list-columns";
import {
  getColumnPrefsSlice,
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
  disabled?: boolean;
  isSaving?: boolean;
  triggerClassName?: string;
  triggerVariant?: "outline" | "ghost";
};

export function ProductListColumnSettings({
  prefs,
  onChange,
  fieldPermissions,
  detectedDeviceClass,
  disabled = false,
  isSaving = false,
  triggerClassName,
  triggerVariant,
}: Props) {
  const [editingLayout, setEditingLayout] = useState<ColumnSettingsLayout>(prefs.viewMode);
  const [editingDevice, setEditingDevice] = useState<ColumnSettingsDevice>(detectedDeviceClass);

  useEffect(() => {
    setEditingLayout(prefs.viewMode);
  }, [prefs.viewMode]);

  useEffect(() => {
    setEditingDevice(detectedDeviceClass);
  }, [detectedDeviceClass]);

  const cardColumnContext =
    editingLayout === "card"
      ? { cardLayout: prefs.cardLayout, cardOrientation: prefs.cardOrientation }
      : undefined;

  const slice = getColumnPrefsSlice(
    prefs,
    editingLayout as ProductListViewMode,
    editingDevice as DeviceClass,
    cardColumnContext
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
            columnPrefs,
            cardColumnContext
          )
        )
      }
      frozenColumnCount={prefs.frozenColumnCount}
      onFrozenColumnCountChange={(frozenColumnCount) =>
        onChange({ ...prefs, frozenColumnCount })
      }
      cardGridColumns={prefs.cardGridColumns[editingDevice as DeviceClass]}
      onCardGridColumnsChange={(columns) =>
        onChange(setCardGridColumnsSlice(prefs, editingDevice as DeviceClass, columns))
      }
      cardLayout={prefs.cardLayout}
      onCardLayoutChange={(cardLayout) => onChange({ ...prefs, cardLayout })}
      cardOrientation={prefs.cardOrientation}
      onCardOrientationChange={(cardOrientation) => onChange({ ...prefs, cardOrientation })}
      cardMetaDisplay={prefs.cardMetaDisplay}
      onCardMetaDisplayChange={(cardMetaDisplay) => onChange({ ...prefs, cardMetaDisplay })}
      isColumnApplicable={(columnId) =>
        editingLayout !== "card"
          ? true
          : isProductCardColumnApplicable(
              columnId as ProductListColumnId,
              prefs.cardLayout,
              prefs.cardOrientation
            )
      }
      columnDisabledReason={(columnId) =>
        editingLayout !== "card"
          ? undefined
          : productCardColumnDisabledReason(
              columnId as ProductListColumnId,
              prefs.cardLayout,
              prefs.cardOrientation
            )
      }
      disabled={disabled}
      isSaving={isSaving}
      triggerClassName={triggerClassName}
      triggerVariant={triggerVariant}
    />
  );
}
