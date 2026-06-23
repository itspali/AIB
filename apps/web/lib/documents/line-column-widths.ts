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

/** Unit column — UOM code + conversion hint (e.g. "1 BOX = 2 PCS"). */
export const DOCUMENT_LINE_UNIT_WIDTH_REM = 6.5;

/** GRN received / on-hold qty columns. */
export const DOCUMENT_LINE_GRN_QTY_WIDTH_REM = 5.5;

/** GRN dock exception qty + reject disposition selector. */
export const DOCUMENT_LINE_GRN_EXCEPTION_WIDTH_REM = 7;

/** GRN calculated hold column (header: Into QC hold). */
export const DOCUMENT_LINE_GRN_HOLD_WIDTH_REM = 6.5;

/** GRN unit cost column. */
export const DOCUMENT_LINE_GRN_UNIT_COST_WIDTH_REM = 7.5;

const LINE_COLUMN_WIDTH_REM: Record<string, number> = {
  line_image: 3.25,
  sku: 5.5,
  quantity_ordered: DOCUMENT_LINE_QTY_WIDTH_REM,
  unit: DOCUMENT_LINE_UNIT_WIDTH_REM,
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
  quantity_received: DOCUMENT_LINE_GRN_QTY_WIDTH_REM,
  exception_quantity: DOCUMENT_LINE_GRN_EXCEPTION_WIDTH_REM,
  quantity_accepted: DOCUMENT_LINE_GRN_HOLD_WIDTH_REM,
  quantity_rejected: DOCUMENT_LINE_GRN_QTY_WIDTH_REM,
  quantity_on_hold: DOCUMENT_LINE_GRN_HOLD_WIDTH_REM,
  dock_exceptions: DOCUMENT_LINE_GRN_QTY_WIDTH_REM,
  posted_to_stock: 7,
  qc_rejected: DOCUMENT_LINE_GRN_QTY_WIDTH_REM,
  raw_unit_cost: DOCUMENT_LINE_GRN_UNIT_COST_WIDTH_REM,
  customs_duty_amount: DOCUMENT_LINE_GRN_UNIT_COST_WIDTH_REM,
  import_igst_amount: DOCUMENT_LINE_GRN_UNIT_COST_WIDTH_REM,
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
  exception_quantity: widthClass(LINE_COLUMN_WIDTH_REM.exception_quantity),
  quantity_accepted: widthClass(LINE_COLUMN_WIDTH_REM.quantity_accepted),
  quantity_rejected: widthClass(LINE_COLUMN_WIDTH_REM.quantity_rejected),
  quantity_on_hold: widthClass(LINE_COLUMN_WIDTH_REM.quantity_on_hold),
  dock_exceptions: widthClass(LINE_COLUMN_WIDTH_REM.dock_exceptions),
  posted_to_stock: widthClass(LINE_COLUMN_WIDTH_REM.posted_to_stock),
  qc_rejected: widthClass(LINE_COLUMN_WIDTH_REM.qc_rejected),
  raw_unit_cost: widthClass(LINE_COLUMN_WIDTH_REM.raw_unit_cost),
  customs_duty_amount: widthClass(LINE_COLUMN_WIDTH_REM.customs_duty_amount),
  import_igst_amount: widthClass(LINE_COLUMN_WIDTH_REM.import_igst_amount),
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

