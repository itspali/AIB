import type { PoLineCatalogContext } from "@/lib/documents/catalog-line-values";
import {
  getPoLayoutColumnPref,
  normalizePoLayoutTemplate,
  type DocumentLayoutDefaults,
} from "@/lib/documents/purchase-order-layout";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";
import type { PurchaseOrderLineRow } from "@/lib/procurement/purchase-orders/types";

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

function trimUnitCode(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

/** Draft line UOM — Phase 3 will prefer `line.uom_code` when editable ordering ships. */
export function resolvePoDraftLineUnitCode(line: PoDraftLine): string | null {
  // Phase 3: return trimUnitCode(line.uom_code) ?? trimUnitCode(line.catalog_context?.base_unit_of_measure);
  return trimUnitCode(line.catalog_context?.base_unit_of_measure);
}

/** Saved PO line UOM for peek/read-only surfaces. */
export function resolvePoPeekLineUnitCode(line: PurchaseOrderLineRow): string | null {
  // Phase 3: return trimUnitCode(line.uom_code) ?? trimUnitCode(line.base_unit_of_measure);
  return trimUnitCode(line.base_unit_of_measure);
}

export function resolvePoLineUnitCodeFromCatalog(
  context: PoLineCatalogContext | null | undefined
): string | null {
  return trimUnitCode(context?.base_unit_of_measure);
}
