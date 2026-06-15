import type { DocumentColumnPref } from "@/lib/documents/types";
import {
  getSalesLayoutColumnPref,
  getSalesLineEntryTableColumns,
  normalizeSalesCommerceLayoutTemplate,
  SALES_LINE_IMAGE_COLUMN_ID,
  type DocumentLayoutDefaults,
  type SalesLineColumnVisibilityOptions,
} from "@/lib/sales/shared/sales-commerce-layout";

/** Embed tax rate under line tax when line tax is in the grid and Tax % is not. */
export function shouldEmbedSalesTaxRateUnderLineTaxFromGrid(
  visibleGridColumns: readonly DocumentColumnPref[]
): boolean {
  const gridIds = visibleGridColumns
    .filter((column) => column.id !== SALES_LINE_IMAGE_COLUMN_ID)
    .map((column) => column.id);
  return gridIds.includes("line_tax_amount") && !gridIds.includes("tax_rate_pct");
}

/** True when Tax % is rendered as its own grid column (not embedded under line tax). */
export function isSalesTaxRateLineFieldVisibleInGrid(
  layout: DocumentLayoutDefaults,
  options?: SalesLineColumnVisibilityOptions
): boolean {
  const normalized = normalizeSalesCommerceLayoutTemplate(layout);
  const gridColumns = getSalesLineEntryTableColumns(normalized, options);
  return !shouldEmbedSalesTaxRateUnderLineTaxFromGrid(gridColumns);
}

/** Embed tax rate under line tax when the line tax column is shown and Tax % is not a grid column. */
export function shouldShowSalesTaxRateUnderLineTaxColumn(
  layout: DocumentLayoutDefaults,
  options?: SalesLineColumnVisibilityOptions
): boolean {
  const normalized = normalizeSalesCommerceLayoutTemplate(layout);
  const gridColumns = getSalesLineEntryTableColumns(normalized, options);
  return shouldEmbedSalesTaxRateUnderLineTaxFromGrid(gridColumns);
}

/** True when the Unit line field is visible in layout (column or item detail). */
export function isSalesUnitLineFieldVisible(layout: DocumentLayoutDefaults): boolean {
  const pref = getSalesLayoutColumnPref(normalizeSalesCommerceLayoutTemplate(layout), "unit");
  return pref?.defaultVisible === true;
}

/** Auto layout: embed unit under Qty when the standalone Unit line field is off. */
export function shouldShowSalesUnitUnderQtyColumn(layout: DocumentLayoutDefaults): boolean {
  return !isSalesUnitLineFieldVisible(layout);
}

/** True when the Discount line field is visible as its own column. */
export function isSalesDiscountPctLineFieldVisible(layout: DocumentLayoutDefaults): boolean {
  return (
    getSalesLayoutColumnPref(normalizeSalesCommerceLayoutTemplate(layout), "discount_pct")
      ?.defaultVisible === true
  );
}

/** Embed computed disc amount under Discount when the standalone Disc amount column is off. */
export function shouldShowSalesDiscountAmountUnderPctColumn(
  layout: DocumentLayoutDefaults
): boolean {
  const normalized = normalizeSalesCommerceLayoutTemplate(layout);
  return (
    isSalesDiscountPctLineFieldVisible(normalized) &&
    getSalesLayoutColumnPref(normalized, "discount_amount")?.defaultVisible !== true
  );
}
