import type { DeviceClass } from "@/lib/layout/device-class";
import { LIST_TABLE_CELL_PADDING_INLINE_PX } from "@/lib/layout/list-table-chrome";
import { clampAutoFitColumnWidth } from "@/lib/list-columns/sizing";
import {
  measureHintsFromValueKind,
  resolveListColumnAutoWidth,
  type ListColumnAutoWidthMeasureHints,
} from "@/lib/list-columns/resolve-column-auto-width";
import {
  measureMaxContentWidth,
  resolveHeaderLabelTypographyElement,
} from "@/lib/list-columns/measure-content-width";
import { getProductListCellDisplayTexts } from "@/lib/products/list-column-display-text";
import { getColumnDef, type ProductListColumnId } from "@/lib/products/list-columns";
import { isSortableColumn } from "@/lib/products/list-sort";
import type { ProductListRow } from "@/lib/products/types";

const IMAGE_CONTENT_WIDTH_PX = 48;

export type ResolveProductListColumnAutoWidthInput = {
  columnId: ProductListColumnId;
  products: ProductListRow[];
  deviceClass: DeviceClass;
  showVariants?: boolean;
  headerElement?: HTMLElement | null;
  /** Override header plain-text used for measurement (e.g. matrix registry labels). */
  headerLabel?: string;
  measureOverrides?: Partial<ListColumnAutoWidthMeasureHints>;
};

export function resolveProductListColumnAutoWidth({
  columnId,
  products,
  deviceClass,
  showVariants = false,
  headerElement,
  headerLabel,
  measureOverrides,
}: ResolveProductListColumnAutoWidthInput): number {
  const column = getColumnDef(columnId);

  if (columnId === "image") {
    const bodyPadding =
      measureOverrides?.bodyPaddingPx ?? LIST_TABLE_CELL_PADDING_INLINE_PX * 2;
    const headerPadding =
      measureOverrides?.headerPaddingPx ?? LIST_TABLE_CELL_PADDING_INLINE_PX * 2;
    const bodyFloor = IMAGE_CONTENT_WIDTH_PX + bodyPadding;
    const headerText = headerLabel ?? column.label;

    const headerWidth = measureMaxContentWidth({
      texts: [headerText],
      typographyElement: resolveHeaderLabelTypographyElement(headerElement),
      paddingPx: headerPadding,
    });

    return clampAutoFitColumnWidth(column, deviceClass, Math.max(bodyFloor, headerWidth));
  }

  const bodyTexts = products.flatMap((product) =>
    getProductListCellDisplayTexts(columnId, product, { showVariants })
  );

  return resolveListColumnAutoWidth({
    column: getColumnDef(columnId),
    deviceClass,
    headerElement,
    headerLabel,
    bodyTexts,
    sortable: isSortableColumn(columnId),
    measure: {
      ...measureHintsFromValueKind(column, {
        statusBadge: columnId === "is_active",
      }),
      mono:
        columnId === "default_sku" ||
        columnId === "barcode" ||
        columnId === "base_unit_of_measure",
      tabular:
        columnId === "selling_price" ||
        columnId === "purchase_price" ||
        columnId === "stock_on_hand" ||
        columnId === "created_at" ||
        columnId === "updated_at",
      ...measureOverrides,
    },
  });
}
