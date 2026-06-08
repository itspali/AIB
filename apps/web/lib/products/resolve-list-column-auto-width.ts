import type { DeviceClass } from "@/lib/layout/device-class";
import { clampUserColumnWidth } from "@/lib/list-columns/sizing";
import {
  measureHintsFromValueKind,
  resolveListColumnAutoWidth,
} from "@/lib/list-columns/resolve-column-auto-width";
import { getProductListCellDisplayTexts } from "@/lib/products/list-column-display-text";
import { getColumnDef, type ProductListColumnId } from "@/lib/products/list-columns";
import { isSortableColumn } from "@/lib/products/list-sort";
import type { ProductListRow } from "@/lib/products/types";

const IMAGE_CELL_PADDING_PX = 8;
const IMAGE_CONTENT_WIDTH_PX = 48;

export type ResolveProductListColumnAutoWidthInput = {
  columnId: ProductListColumnId;
  products: ProductListRow[];
  deviceClass: DeviceClass;
  showVariants?: boolean;
  headerElement?: HTMLElement | null;
};

export function resolveProductListColumnAutoWidth({
  columnId,
  products,
  deviceClass,
  showVariants = false,
  headerElement,
}: ResolveProductListColumnAutoWidthInput): number {
  const column = getColumnDef(columnId);

  if (columnId === "image") {
    return clampUserColumnWidth(
      column,
      deviceClass,
      IMAGE_CONTENT_WIDTH_PX + IMAGE_CELL_PADDING_PX
    );
  }

  const bodyTexts = products.flatMap((product) =>
    getProductListCellDisplayTexts(columnId, product, { showVariants })
  );

  return resolveListColumnAutoWidth({
    column,
    deviceClass,
    headerElement,
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
    },
  });
}
