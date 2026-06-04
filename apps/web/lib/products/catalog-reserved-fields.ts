import { RESERVED_COMMERCE_CUSTOM_FIELD_KEYS } from "@/lib/products/item-uom-commerce";

/** Keys used for MRP in `items.custom_fields` (no first-class column yet). */
export const MRP_CUSTOM_FIELD_KEYS = ["mrp", "max_retail_price", "maximum_retail_price"];

/** Keys used for default reorder point in `items.custom_fields` until per-location buffers are edited in UI. */
export const REORDER_POINT_CUSTOM_FIELD_KEYS = ["reorder_point", "reorder_point_qty"];

/** Fallback when multi-SKU master commerce sync does not write price book rows yet. */
export const DEFAULT_SELLING_PRICE_CUSTOM_FIELD_KEY = "_default_selling_price";

/** Fallback when purchase rate is set without a preferred supplier row. */
export const DEFAULT_PURCHASE_PRICE_CUSTOM_FIELD_KEY = "_default_purchase_price";

const RESERVED_CATALOG_FORM_FIELD_KEYS = new Set(
  [
    "sku_mask",
    ...MRP_CUSTOM_FIELD_KEYS,
    ...REORDER_POINT_CUSTOM_FIELD_KEYS,
    DEFAULT_SELLING_PRICE_CUSTOM_FIELD_KEY,
    DEFAULT_PURCHASE_PRICE_CUSTOM_FIELD_KEY,
    ...RESERVED_COMMERCE_CUSTOM_FIELD_KEYS,
  ].map((key) => key.toLowerCase())
);

export function isReservedCatalogFormFieldKey(key: string): boolean {
  return RESERVED_CATALOG_FORM_FIELD_KEYS.has(key.trim().toLowerCase());
}

export function normalizeCatalogQuantityField(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed === "0") return "";
  return trimmed;
}

function extractReservedStringFromRecord(
  raw: Record<string, unknown> | null | undefined,
  keys: readonly string[]
): string {
  if (!raw) return "";
  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  for (const [key, value] of Object.entries(raw)) {
    if (!wanted.has(key.trim().toLowerCase())) continue;
    if (value === null || value === undefined) continue;
    return normalizeCatalogQuantityField(String(value));
  }
  return "";
}

export function extractMrpFromCustomFieldsRecord(
  raw: Record<string, unknown> | null | undefined
): string {
  return extractReservedStringFromRecord(raw, MRP_CUSTOM_FIELD_KEYS);
}

export function extractReorderPointFromCustomFieldsRecord(
  raw: Record<string, unknown> | null | undefined
): string {
  return extractReservedStringFromRecord(raw, REORDER_POINT_CUSTOM_FIELD_KEYS);
}

export function extractDefaultSellingPriceFromCustomFieldsRecord(
  raw: Record<string, unknown> | null | undefined
): string {
  return extractReservedStringFromRecord(raw, [DEFAULT_SELLING_PRICE_CUSTOM_FIELD_KEY]);
}

export function extractDefaultPurchasePriceFromCustomFieldsRecord(
  raw: Record<string, unknown> | null | undefined
): string {
  return extractReservedStringFromRecord(raw, [DEFAULT_PURCHASE_PRICE_CUSTOM_FIELD_KEY]);
}

export function extractMrpFromCustomFields(
  fields: ReadonlyArray<{ key: string; value: string }> | undefined
): string {
  if (!fields?.length) return "";
  const wanted = new Set(MRP_CUSTOM_FIELD_KEYS.map((key) => key.toLowerCase()));
  for (const row of fields) {
    const key = row.key.trim().toLowerCase();
    if (wanted.has(key)) {
      return normalizeCatalogQuantityField(row.value);
    }
  }
  return "";
}

export function extractReorderPointFromCustomFields(
  fields: ReadonlyArray<{ key: string; value: string }> | undefined
): string {
  if (!fields?.length) return "";
  const wanted = new Set(REORDER_POINT_CUSTOM_FIELD_KEYS.map((key) => key.toLowerCase()));
  for (const row of fields) {
    const key = row.key.trim().toLowerCase();
    if (wanted.has(key)) {
      return normalizeCatalogQuantityField(row.value);
    }
  }
  return "";
}

/** User-defined custom field rows only (excludes MRP, reorder point, commerce defaults). */
export function filterUserCustomFieldEntries(
  entries: ReadonlyArray<{ key: string; value: string }>
): Array<{ key: string; value: string }> {
  return entries.filter((row) => !isReservedCatalogFormFieldKey(row.key));
}

export function buildReservedCatalogCustomFieldsPayload(values: {
  mrp?: string;
  reorder_point?: string;
  selling_price?: string;
  purchase_price?: string;
  variant_strategy?: string;
  supplier_id?: string | null;
}): Record<string, string> {
  const payload: Record<string, string> = {};
  const mrp = normalizeCatalogQuantityField(values.mrp);
  if (mrp) payload.mrp = mrp;
  const reorder = normalizeCatalogQuantityField(values.reorder_point);
  if (reorder) payload.reorder_point = reorder;

  const selling = normalizeCatalogQuantityField(values.selling_price);
  const purchase = normalizeCatalogQuantityField(values.purchase_price);

  if (selling) {
    payload[DEFAULT_SELLING_PRICE_CUSTOM_FIELD_KEY] = selling;
  }
  if (purchase && !values.supplier_id) {
    payload[DEFAULT_PURCHASE_PRICE_CUSTOM_FIELD_KEY] = purchase;
  }

  return payload;
}
