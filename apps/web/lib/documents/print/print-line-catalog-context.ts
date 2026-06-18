import {
  emptyPoLineCatalogContext,
  type PoLineCatalogContext,
} from "@/lib/documents/catalog-line-values";

function normalizeStringRecord(
  value: Record<string, unknown> | null | undefined
): Record<string, string> {
  if (!value) return {};
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (raw == null) continue;
    const text = String(raw).trim();
    if (text) out[key] = text;
  }
  return out;
}

/** Build catalog snapshot for print/detail fields from persisted line + item master joins. */
export function buildPrintLineCatalogContext(input: {
  catalog_context?: PoLineCatalogContext | null;
  description?: string | null;
  hsn_sac_code?: string | null;
  base_unit_of_measure?: string | null;
  uom_code?: string | null;
  mrp?: string | null;
  tax_rate_percentage?: string | null;
  variant_attributes?: Record<string, unknown> | null;
  custom_fields?: Record<string, unknown> | null;
}): PoLineCatalogContext | null {
  if (input.catalog_context) return input.catalog_context;

  const variantAttributes = normalizeStringRecord(input.variant_attributes);
  const customFields = normalizeStringRecord(input.custom_fields);
  const description = input.description?.trim() || null;
  const hsnSacCode = input.hsn_sac_code?.trim() || null;
  const baseUnit = input.base_unit_of_measure?.trim() || input.uom_code?.trim() || null;
  const mrp = input.mrp?.trim() || null;
  const taxRate = Number(input.tax_rate_percentage ?? 0);

  if (
    !description &&
    !hsnSacCode &&
    !baseUnit &&
    !mrp &&
    Object.keys(variantAttributes).length === 0 &&
    Object.keys(customFields).length === 0
  ) {
    return null;
  }

  return {
    ...emptyPoLineCatalogContext(),
    description,
    hsn_sac_code: hsnSacCode,
    base_unit_of_measure: baseUnit,
    mrp,
    tax_rate: Number.isFinite(taxRate) ? taxRate : 0,
    variant_attributes: variantAttributes,
    custom_fields: customFields,
    catalog_snapshot_source: "server",
  };
}
