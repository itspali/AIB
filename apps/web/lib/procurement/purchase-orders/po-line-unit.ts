import {
  canEditPoLineUom,
  resolvePoDraftLineUomCode,
  resolvePoLineUnitCodeFromCatalog,
  resolvePoPeekLineUomCode,
} from "@/lib/procurement/purchase-orders/po-line-uom-options";
import type { PoLineCatalogContext } from "@/lib/documents/catalog-line-values";
import {
  getPoLayoutColumnPref,
  normalizePoLayoutTemplate,
  type DocumentLayoutDefaults,
} from "@/lib/documents/purchase-order-layout";

export {
  canEditPoLineUom,
  resolvePoDraftLineUomCode,
  resolvePoLineUnitCodeFromCatalog,
  resolvePoPeekLineUomCode,
  resolvePoLineUomOptions,
  resolveDefaultPoLineUomCode,
  resolvePoLineUomAfterCatalogUpdate,
  resolvePoLineUomConversionFactor,
  formatPoLineUomConversionHint,
  formatPoPeekLineUomConversionHint,
} from "@/lib/procurement/purchase-orders/po-line-uom-options";

/** @deprecated Prefer `resolvePoDraftLineUomCode` — alias kept for existing imports. */
export { resolvePoDraftLineUomCode as resolvePoDraftLineUnitCode } from "@/lib/procurement/purchase-orders/po-line-uom-options";

/** @deprecated Prefer `resolvePoPeekLineUomCode` — alias kept for existing imports. */
export { resolvePoPeekLineUomCode as resolvePoPeekLineUnitCode } from "@/lib/procurement/purchase-orders/po-line-uom-options";

/** True when the Unit line field is visible in layout (column or item detail). */
export function isPoUnitLineFieldVisible(
  layout: DocumentLayoutDefaults
): boolean {
  const pref = getPoLayoutColumnPref(normalizePoLayoutTemplate(layout), "unit");
  return pref?.defaultVisible === true;
}

/** Auto layout: embed unit under Qty when the standalone Unit line field is off. */
export function shouldShowPoUnitUnderQtyColumn(
  layout: DocumentLayoutDefaults
): boolean {
  return !isPoUnitLineFieldVisible(layout);
}

export type { PoLineCatalogContext };
