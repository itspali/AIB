/** Minimum width for the item column — grows with remaining table space, no max cap. */
export const DOCUMENT_LINE_ITEM_COLUMN_MIN_WIDTH_REM = 16;

const LINE_COLUMN_WIDTH_REM: Record<string, number> = {
  line_image: 3.25,
  sku: 5.5,
  quantity_ordered: 5,
  unit: 3.25,
  unit_price: 5.5,
  line_total: 5.5,
  discount_pct: 4,
  discount_amount: 5.5,
  quantity_received: 4.5,
};

const LINE_COLUMN_WIDTH_CLASS: Record<string, string> = {
  item: "min-w-[16rem]",
  line_image: "w-[3.25rem]",
  sku: "w-[5.5rem]",
  quantity_ordered: "w-[5rem]",
  unit: "w-[3.25rem]",
  unit_price: "w-[5.5rem]",
  line_total: "w-[5.5rem]",
  discount_pct: "w-[4rem]",
  discount_amount: "w-[5.5rem]",
  quantity_received: "w-[4.5rem]",
};

export function getDocumentLineColumnWidthClass(columnId: string): string | undefined {
  return LINE_COLUMN_WIDTH_CLASS[columnId] ?? "w-[5rem]";
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
