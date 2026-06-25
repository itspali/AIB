"use client";

import { useEffect, useMemo, useState } from "react";
import { List } from "lucide-react";
import {
  HorizontalCardsStackedIcon,
  ShopCardsRowIcon,
} from "@/components/products/product-list-view-icons";
import {
  ListColumnSettings,
  type ColumnSettingsLayout,
  type ColumnSettingsLayoutPreset,
} from "@/components/list-columns/list-column-settings";
import {
  LIST_MODULE_COLUMN_SETTINGS_CHROME,
  useColumnSettingsEditingDevice,
} from "@/lib/list-columns/list-module-column-settings";
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
import { ITEMS_WORKSPACE_DISABLED_COLUMNS, ITEMS_WORKSPACE_PINNED_COLUMNS } from "@/lib/items/split-feed-card-plan";
import {
  getColumnPrefsContextForDisplayPreset,
  getColumnPrefsSlice,
  getProductListDisplayPreset,
  setCardGridColumnsSlice,
  setColumnPrefsSlice,
  setColumnPrefsSliceAllDevices,
  type DeviceClass,
  type ProductListDisplayPreset,
  type ProductListPrefs,
} from "@/lib/products/list-prefs";
import type { ListWorkspaceLayout } from "@/lib/layout/list-workspace";

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
  /** Items catalog — full column prefs; card layout presets hidden (workspace uses table). */
  mode?: "default" | "items-matrix";
  /** Split layout — unified columns across breakpoints; hides screen/freeze controls. */
  workspaceLayout?: ListWorkspaceLayout;
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
  mode = "default",
  workspaceLayout,
}: Props) {
  const isItemsMatrix = mode === "items-matrix";
  const isSplitWorkspace = isItemsMatrix && workspaceLayout === "split";
  const activePreset = getProductListDisplayPreset(prefs);
  const [editingPreset, setEditingPreset] = useState<ProductListDisplayPreset>(
    isItemsMatrix ? "list" : activePreset
  );
  useEffect(() => {
    if (!isItemsMatrix) setEditingPreset(activePreset);
  }, [activePreset, isItemsMatrix]);

  const [editingDevice, setEditingDevice] = useColumnSettingsEditingDevice(detectedDeviceClass);

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
      layoutPresets={isItemsMatrix ? undefined : PRODUCT_COLUMN_LAYOUT_PRESETS}
      editingLayoutPreset={isItemsMatrix ? "list" : editingPreset}
      onEditingLayoutPresetChange={
        isItemsMatrix
          ? undefined
          : (presetId) => setEditingPreset(presetId as ProductListDisplayPreset)
      }
      showDeviceSwitcher={!isItemsMatrix || workspaceLayout !== "split"}
      {...LIST_MODULE_COLUMN_SETTINGS_CHROME}
      showLayoutSwitcher={!isItemsMatrix}
      onChange={(columnPrefs) =>
        onChange(
          isSplitWorkspace
            ? setColumnPrefsSliceAllDevices(
                prefs,
                editingLayout === "card" ? "card" : "table",
                columnPrefs,
                cardColumnContext
              )
            : setColumnPrefsSlice(
                prefs,
                editingLayout,
                editingDevice as DeviceClass,
                columnPrefs,
                cardColumnContext
              )
        )
      }
      frozenColumnCount={isSplitWorkspace ? undefined : prefs.frozenColumnCount}
      onFrozenColumnCountChange={
        isSplitWorkspace
          ? undefined
          : (frozenColumnCount) => onChange({ ...prefs, frozenColumnCount })
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
      lockedColumnIds={isItemsMatrix ? ITEMS_WORKSPACE_PINNED_COLUMNS : undefined}
      disabledColumnIds={isItemsMatrix ? ITEMS_WORKSPACE_DISABLED_COLUMNS : undefined}
      disabledColumnReason="Inactive items use row styling instead"
      disabled={disabled}
      isSaving={isSaving}
      triggerClassName={triggerClassName}
      triggerVariant={triggerVariant}
    />
  );
}
