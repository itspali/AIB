import type { DeviceClass } from "@/lib/layout/device-class";
import type { CardGridColumnCount, ProductListFrozenColumnCount } from "@/lib/products/list-prefs";

/** Map list-pane width to the column layout tier when the detail split is open. */
export function resolveListPaneDeviceClass(
  viewportDeviceClass: DeviceClass,
  listPaneWidth: number | undefined,
  detailPaneOpen: boolean
): DeviceClass {
  if (!detailPaneOpen || listPaneWidth == null) return viewportDeviceClass;
  if (listPaneWidth < 480) return "mobile";
  if (listPaneWidth < 768) return "tablet";
  return viewportDeviceClass;
}

export type ListPaneLayoutOverrides = {
  deviceClass: DeviceClass;
  frozenColumnCount: ProductListFrozenColumnCount;
  cardGridColumns: CardGridColumnCount;
  freezeColumnsAuto: boolean;
};

export function resolveListPaneLayoutOverrides(input: {
  viewportDeviceClass: DeviceClass;
  listPaneWidth: number | undefined;
  detailPaneOpen: boolean;
  frozenColumnCount: ProductListFrozenColumnCount;
  cardGridColumns: CardGridColumnCount;
  freezeColumnsAuto: boolean;
}): ListPaneLayoutOverrides {
  if (!input.detailPaneOpen) {
    return {
      deviceClass: input.viewportDeviceClass,
      frozenColumnCount: input.frozenColumnCount,
      cardGridColumns: input.cardGridColumns,
      freezeColumnsAuto: input.freezeColumnsAuto,
    };
  }

  const deviceClass = resolveListPaneDeviceClass(
    input.viewportDeviceClass,
    input.listPaneWidth,
    true
  );

  return {
    deviceClass,
    frozenColumnCount: 0,
    cardGridColumns: 1,
    freezeColumnsAuto: false,
  };
}
