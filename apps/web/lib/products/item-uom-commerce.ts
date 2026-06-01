import type { ProductMasterInput } from "@/lib/products/schemas";

/** Reserved custom_fields keys for default commerce units (not shown in custom field UI). */
export const COMMERCE_DEFAULT_PURCHASE_UOM_KEY = "_default_purchase_uom";
export const COMMERCE_DEFAULT_SELLING_UOM_KEY = "_default_selling_uom";

export const RESERVED_COMMERCE_CUSTOM_FIELD_KEYS = new Set([
  COMMERCE_DEFAULT_PURCHASE_UOM_KEY,
  COMMERCE_DEFAULT_SELLING_UOM_KEY,
]);

export type AlternateUomRow = { uom_code: string; conversion_factor: string };

export function conversionFactorForAlternate(
  alternates: ReadonlyArray<AlternateUomRow>,
  uomCode: string
): string | undefined {
  const trimmed = uomCode.trim();
  if (!trimmed) return undefined;
  const row = alternates.find((entry) => entry.uom_code.trim() === trimmed);
  const factor = row?.conversion_factor?.trim();
  return factor || undefined;
}

export function hasCatalogConversionForUnit(
  alternates: ReadonlyArray<AlternateUomRow>,
  stockUom: string,
  unitCode: string
): boolean {
  if (unitCode.trim() === stockUom.trim()) return true;
  return conversionFactorForAlternate(alternates, unitCode) !== undefined;
}

function parseFactor(value: string, fallback = 1): number {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function upsertAlternateRow(
  rows: Array<{ uom_code: string; conversion_factor: number }>,
  uomCode: string,
  conversionFactor: number
) {
  const index = rows.findIndex((row) => row.uom_code === uomCode);
  const entry = { uom_code: uomCode, conversion_factor: conversionFactor };
  if (index >= 0) {
    rows[index] = entry;
  } else {
    rows.unshift(entry);
  }
}

/** Merged alternate UOM rows sent to sync_product_alternate_uoms (catalog + commerce defaults). */
export function buildAlternateUomsPayload(values: ProductMasterInput) {
  const base = values.base_unit_of_measure.trim();
  const rows = values.alternate_uoms.map((row) => ({
    uom_code: row.uom_code.trim(),
    conversion_factor: parseFactor(row.conversion_factor, 1),
  }));

  if (values.purchase_uom.trim() !== base) {
    const purchaseCode = values.purchase_uom.trim();
    const factor = parseFactor(
      conversionFactorForAlternate(values.alternate_uoms, purchaseCode) ??
        values.purchase_uom_conversion,
      1
    );
    upsertAlternateRow(rows, purchaseCode, factor);
  }

  if (values.selling_uom.trim() !== base) {
    const sellingCode = values.selling_uom.trim();
    const catalogFactor = conversionFactorForAlternate(values.alternate_uoms, sellingCode);
    if (catalogFactor) {
      upsertAlternateRow(rows, sellingCode, parseFactor(catalogFactor, 1));
    }
  }

  return rows;
}

export function buildCommerceCustomFieldDefaults(values: ProductMasterInput): Record<string, string> {
  const base = values.base_unit_of_measure.trim();
  const payload: Record<string, string> = {};

  if (values.purchase_uom.trim() !== base) {
    payload[COMMERCE_DEFAULT_PURCHASE_UOM_KEY] = values.purchase_uom.trim();
  }
  if (values.selling_uom.trim() !== base) {
    payload[COMMERCE_DEFAULT_SELLING_UOM_KEY] = values.selling_uom.trim();
  }

  return payload;
}

export function resolvePurchaseUomFromItemUoms(
  rows: ReadonlyArray<{ uom_code: string; conversion_factor: number | string }> | null | undefined,
  baseUom: string,
  preferredCode?: string | null
): { uom_code: string; conversion_factor: string } | null {
  if (!rows?.length) return null;
  const base = baseUom.trim();
  const preferred = preferredCode?.trim();
  if (preferred && preferred !== base) {
    const match = rows.find((row) => row.uom_code === preferred);
    if (match) {
      return {
        uom_code: match.uom_code,
        conversion_factor: String(match.conversion_factor),
      };
    }
  }
  const fallback = rows.find((row) => row.uom_code !== base);
  if (!fallback) return null;
  return {
    uom_code: fallback.uom_code,
    conversion_factor: String(fallback.conversion_factor),
  };
}
