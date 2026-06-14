import type { PoLineCatalogContext } from "@/lib/documents/catalog-line-values";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";
import { resolveDefaultPoLineUomCode } from "@/lib/procurement/purchase-orders/po-line-uom-options";

/** Catalog values captured when a PO line is hydrated (baseline for write-back prompts). */
export type PoLineWritebackSnapshot = {
  catalog_mrp: string | null;
  catalog_purchase_price: string | null;
  catalog_supplier_price: string | null;
  catalog_purchase_uom: string | null;
  catalog_hsn_sac_code: string | null;
  catalog_tax_code_id: string | null;
  catalog_tax_rate: string | null;
};

export function emptyWritebackSnapshot(): PoLineWritebackSnapshot {
  return {
    catalog_mrp: null,
    catalog_purchase_price: null,
    catalog_supplier_price: null,
    catalog_purchase_uom: null,
    catalog_hsn_sac_code: null,
    catalog_tax_code_id: null,
    catalog_tax_rate: null,
  };
}

export function writebackSnapshotFromCatalogContext(
  context: PoLineCatalogContext
): PoLineWritebackSnapshot {
  const baseUom = context.base_unit_of_measure?.trim() || null;
  const taxRate =
    context.tax_rate != null && Number.isFinite(context.tax_rate) ? String(context.tax_rate) : null;
  return {
    catalog_mrp: context.mrp?.trim() || null,
    catalog_purchase_price: context.purchase_price?.trim() || null,
    catalog_supplier_price: null,
    catalog_purchase_uom: resolveDefaultPoLineUomCode(context) || baseUom,
    catalog_hsn_sac_code: context.hsn_sac_code?.trim() || null,
    catalog_tax_code_id: context.tax_code_id?.trim() || null,
    catalog_tax_rate: taxRate,
  };
}

export function mergeWritebackSnapshot(
  current: PoLineWritebackSnapshot | undefined,
  patch: Partial<PoLineWritebackSnapshot>
): PoLineWritebackSnapshot {
  return {
    ...emptyWritebackSnapshot(),
    ...current,
    ...patch,
  };
}

export function attachWritebackSnapshotFromCatalog(
  line: PoDraftLine,
  context: PoLineCatalogContext
): PoDraftLine {
  return {
    ...line,
    writeback_snapshot: mergeWritebackSnapshot(writebackSnapshotFromCatalogContext(context), {
      catalog_supplier_price:
        line.writeback_snapshot?.catalog_supplier_price ?? null,
    }),
  };
}

export function attachSupplierPriceSnapshot(
  line: PoDraftLine,
  supplierPrice: string | null | undefined
): PoDraftLine {
  const normalized = supplierPrice?.trim() || null;
  if (!normalized) return line;
  return {
    ...line,
    writeback_snapshot: mergeWritebackSnapshot(line.writeback_snapshot, {
      catalog_supplier_price: normalized,
    }),
  };
}
