/** Minimum width for the item column — grows with remaining table space, no max cap. */
export const DOCUMENT_LINE_ITEM_COLUMN_MIN_WIDTH_REM = 16;

/**
 * Qty column — fits grouped values like `9,999.999` (text-sm tabular + cell padding).
 */
export const DOCUMENT_LINE_QTY_WIDTH_REM = 7;

/**
 * Money / rate columns — fits grouped values like `99,999,999.99`
 * (9 integer digits + 2 decimals) without clipping.
 */
export const DOCUMENT_LINE_COMMERCIAL_MONEY_WIDTH_REM = 8.5;

/** Discount % column — value + %/Amt subline selector. */
export const DOCUMENT_LINE_DISCOUNT_PCT_WIDTH_REM = 7;

const LINE_COLUMN_WIDTH_REM: Record<string, number> = {
  line_image: 3.25,
  sku: 5.5,
  quantity_ordered: DOCUMENT_LINE_QTY_WIDTH_REM,
  unit: 3.25,
  unit_price: DOCUMENT_LINE_COMMERCIAL_MONEY_WIDTH_REM,
  mrp: DOCUMENT_LINE_COMMERCIAL_MONEY_WIDTH_REM,
  line_total: DOCUMENT_LINE_COMMERCIAL_MONEY_WIDTH_REM,
  discount_pct: DOCUMENT_LINE_DISCOUNT_PCT_WIDTH_REM,
  discount_amount: DOCUMENT_LINE_COMMERCIAL_MONEY_WIDTH_REM,
  tax_rate_pct: 4.5,
  line_tax_amount: DOCUMENT_LINE_COMMERCIAL_MONEY_WIDTH_REM,
  cgst_amount: DOCUMENT_LINE_COMMERCIAL_MONEY_WIDTH_REM,
  sgst_amount: DOCUMENT_LINE_COMMERCIAL_MONEY_WIDTH_REM,
  igst_amount: DOCUMENT_LINE_COMMERCIAL_MONEY_WIDTH_REM,
  quantity_received: 4.5,
};

function widthClass(rem: number): string {
  return `w-[${rem}rem]`;
}

const LINE_COLUMN_WIDTH_CLASS: Record<string, string> = {
  item: `min-w-[${DOCUMENT_LINE_ITEM_COLUMN_MIN_WIDTH_REM}rem]`,
  line_image: widthClass(LINE_COLUMN_WIDTH_REM.line_image),
  sku: widthClass(LINE_COLUMN_WIDTH_REM.sku),
  quantity_ordered: widthClass(LINE_COLUMN_WIDTH_REM.quantity_ordered),
  unit: widthClass(LINE_COLUMN_WIDTH_REM.unit),
  unit_price: widthClass(LINE_COLUMN_WIDTH_REM.unit_price),
  mrp: widthClass(LINE_COLUMN_WIDTH_REM.mrp),
  line_total: widthClass(LINE_COLUMN_WIDTH_REM.line_total),
  discount_pct: widthClass(LINE_COLUMN_WIDTH_REM.discount_pct),
  discount_amount: widthClass(LINE_COLUMN_WIDTH_REM.discount_amount),
  tax_rate_pct: widthClass(LINE_COLUMN_WIDTH_REM.tax_rate_pct),
  line_tax_amount: widthClass(LINE_COLUMN_WIDTH_REM.line_tax_amount),
  cgst_amount: widthClass(LINE_COLUMN_WIDTH_REM.cgst_amount),
  sgst_amount: widthClass(LINE_COLUMN_WIDTH_REM.sgst_amount),
  igst_amount: widthClass(LINE_COLUMN_WIDTH_REM.igst_amount),
  quantity_received: widthClass(LINE_COLUMN_WIDTH_REM.quantity_received),
};

export function getDocumentLineColumnWidthClass(columnId: string): string | undefined {
  return LINE_COLUMN_WIDTH_CLASS[columnId] ?? widthClass(5);
}

/** Fixed `<col>` width in rem; item uses min width and fills remaining space. */
export function getDocumentLineColumnWidthRem(columnId: string): number | undefined {
  if (columnId === "item") return undefined;
  return LINE_COLUMN_WIDTH_REM[columnId] ?? 5;
}

/** Minimum `<col>` width in rem (item column only). */
export function getDocumentLineColumnMinWidthRem(columnId: string): number | undefined {
  if (columnId === "item") return DOCUMENT_LINE_ITEM_COLUMN_MIN_WIDTH_REM;
  return undefined;
}

export function computeDocumentLineMinTableWidth(
  columnIds: readonly string[],
  options?: { lineNumber?: boolean; remove?: boolean; minItemRem?: number }
): string {
  const lineNumber = options?.lineNumber !== false ? 2.25 : 0;
  const remove = options?.remove !== false ? 2.25 : 0;
  const minItemRem = options?.minItemRem ?? DOCUMENT_LINE_ITEM_COLUMN_MIN_WIDTH_REM;

  let total = lineNumber + remove;
  for (const columnId of columnIds) {
    if (columnId === "item") {
      total += minItemRem;
    } else {
      total += LINE_COLUMN_WIDTH_REM[columnId] ?? 5;
    }
  }

  return `min-w-[${Math.ceil(total)}rem]`;
}

