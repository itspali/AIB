import type { DeviceClass } from "@/lib/layout/device-class";
import {
  clampUserColumnWidth,
} from "@/lib/list-columns/sizing";
import { measureMaxContentWidth, resolveMeasureClassName } from "@/lib/list-columns/measure-content-width";
import { getColumnDef, type ProductListColumnId } from "@/lib/products/list-columns";
import { getProductListCellDisplayTexts } from "@/lib/products/list-column-display-text";
import { isSortableColumn } from "@/lib/products/list-sort";
import type { ProductListRow } from "@/lib/products/types";

const HEADER_CELL_PADDING_PX = 20;
const BODY_CELL_PADDING_PX = 20;
const IMAGE_CELL_PADDING_PX = 8;
const IMAGE_CONTENT_WIDTH_PX = 48;
const SORT_INDICATOR_EXTRA_PX = 22;
const STATUS_BADGE_EXTRA_PX = 20;

function isMonoColumn(columnId: ProductListColumnId): boolean {
  return (
    columnId === "default_sku" ||
    columnId === "barcode" ||
    columnId === "base_unit_of_measure"
  );
}

function isTabularColumn(columnId: ProductListColumnId): boolean {
  return (
    columnId === "selling_price" ||
    columnId === "purchase_price" ||
    columnId === "stock_on_hand" ||
    columnId === "created_at" ||
    columnId === "updated_at"
  );
}

export type ResolveListColumnAutoWidthInput = {
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
}: ResolveListColumnAutoWidthInput): number {
  const column = getColumnDef(columnId);

  if (columnId === "image") {
    return clampUserColumnWidth(
      column,
      deviceClass,
      IMAGE_CONTENT_WIDTH_PX + IMAGE_CELL_PADDING_PX
    );
  }

  const measureClass = resolveMeasureClassName({
    mono: isMonoColumn(columnId),
    tabular: isTabularColumn(columnId),
  });

  const bodyTexts = products.flatMap((product) =>
    getProductListCellDisplayTexts(columnId, product, { showVariants })
  );

  const headerWidth = measureMaxContentWidth({
    texts: [column.label],
    referenceElement: headerElement,
    className: measureClass,
    paddingPx: HEADER_CELL_PADDING_PX,
    extraPx: isSortableColumn(columnId) ? SORT_INDICATOR_EXTRA_PX : 0,
  });

  const bodyWidth = measureMaxContentWidth({
    texts: bodyTexts.length > 0 ? bodyTexts : ["—"],
    referenceElement: headerElement,
    className: measureClass,
    paddingPx: BODY_CELL_PADDING_PX,
    extraPx: columnId === "is_active" ? STATUS_BADGE_EXTRA_PX : 0,
  });

  const target = Math.max(headerWidth, bodyWidth);

  return clampUserColumnWidth(column, deviceClass, target);
}
