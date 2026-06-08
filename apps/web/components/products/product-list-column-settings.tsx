"use client";

import { useEffect, useMemo, useState } from "react";
import { List } from "lucide-react";
import {
  HorizontalCardsStackedIcon,
  ShopCardsRowIcon,
} from "@/components/products/product-list-view-icons";
import {
  ListColumnSettings,
  type ColumnSettingsDevice,
  type ColumnSettingsLayout,
  type ColumnSettingsLayoutPreset,
} from "@/components/list-columns/list-column-settings";
import { resolveViewableColumnIds } from "@/lib/list-columns/types";
import {
  isProductFieldAllowed,
  type ProductFieldPermissions,
} from "@/lib/products/field-permissions";
import {
  isProductCardColumnApplicable,
  productCardColumnDisabledReason,
} from "@/lib/products/card-column-applicability";
import { PRODUCT_LIST_COLUMN_REGISTRY, type ProductListColumnId } from "@/lib/products/list-columns";
import {
  getColumnPrefsContextForDisplayPreset,
  getColumnPrefsSlice,
  getProductListDisplayPreset,
  setCardGridColumnsSlice,
  setColumnPrefsSlice,
  type DeviceClass,
  type ProductListDisplayPreset,
  type ProductListPrefs,
} from "@/lib/products/list-prefs";

const PRODUCT_COLUMN_LAYOUT_PRESETS: ColumnSettingsLayoutPreset[] = [
  { id: "list", label: "List", title: "List layout", icon: List },
  {
    id: "horizontal",
    label: "Horizontal",
    title: "Horizontal card layout",
    icon: HorizontalCardsStackedIcon,
  },
  { id: "shop", label: "Shop", title: "Shop card layout", icon: ShopCardsRowIcon },
];

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

function presetToEditingLayout(preset: ProductListDisplayPreset): ColumnSettingsLayout {
  return preset === "list" ? "table" : "card";
}

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
  const activePreset = getProductListDisplayPreset(prefs);
  const [editingPreset, setEditingPreset] = useState<ProductListDisplayPreset>(activePreset);
  const [editingDevice, setEditingDevice] = useState<ColumnSettingsDevice>(detectedDeviceClass);

  useEffect(() => {
    setEditingPreset(activePreset);
  }, [activePreset]);

  useEffect(() => {
    setEditingDevice(detectedDeviceClass);
  }, [detectedDeviceClass]);

  const editingLayout = presetToEditingLayout(editingPreset);
  const cardColumnContext = getColumnPrefsContextForDisplayPreset(editingPreset);

  const slice = getColumnPrefsSlice(
    prefs,
    editingLayout,
    editingDevice as DeviceClass,
    cardColumnContext
  );

  const viewableColumnIds = useMemo(
    () =>
      resolveViewableColumnIds(PRODUCT_LIST_COLUMN_REGISTRY, (permissionKey) =>
        isProductFieldAllowed(permissionKey, fieldPermissions)
      ),
    [fieldPermissions]
  );

  const cardLayout = cardColumnContext?.cardLayout ?? prefs.cardLayout;
  const cardOrientation = cardColumnContext?.cardOrientation ?? prefs.cardOrientation;

  return (
    <ListColumnSettings
      registry={PRODUCT_LIST_COLUMN_REGISTRY}
      prefs={slice}
      allowedColumnIds={viewableColumnIds}
      editingLayout={editingLayout}
      editingDevice={editingDevice}
      detectedDevice={detectedDeviceClass}
      onEditingLayoutChange={() => {}}
      onEditingDeviceChange={setEditingDevice}
      layoutPresets={PRODUCT_COLUMN_LAYOUT_PRESETS}
      editingLayoutPreset={editingPreset}
      onEditingLayoutPresetChange={(presetId) =>
        setEditingPreset(presetId as ProductListDisplayPreset)
      }
      hideCardVariantControls
      controlBarLayout="split"
      onChange={(columnPrefs) =>
        onChange(
          setColumnPrefsSlice(
            prefs,
            editingLayout,
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
      cardLayout={cardLayout}
      cardOrientation={cardOrientation}
      cardMetaDisplay={prefs.cardMetaDisplay}
      isColumnApplicable={(columnId) =>
        editingLayout !== "card"
          ? true
          : isProductCardColumnApplicable(
              columnId as ProductListColumnId,
              cardLayout,
              cardOrientation
            )
      }
      columnDisabledReason={(columnId) =>
        editingLayout !== "card"
          ? undefined
          : productCardColumnDisabledReason(
              columnId as ProductListColumnId,
              cardLayout,
              cardOrientation
            )
      }
      disabled={disabled}
      isSaving={isSaving}
      triggerClassName={triggerClassName}
      triggerVariant={triggerVariant}
    />
  );
}
