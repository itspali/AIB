import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeDocumentDecimalInput } from "@/lib/documents/decimal-format";
import { extractDefaultPurchasePriceFromCustomFieldsRecord } from "@/lib/products/catalog-reserved-fields";

const VARIANT_ITEM_EMBED = "items!item_variants_item_tenant_fk";

/** Default precision for PO offer unit price (matches `unit_price` column default). */
export const PO_LINE_OFFER_UNIT_PRICE_DECIMAL_PLACES = 2;

function parsePositivePrice(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? trimmed : null;
}

function formatResolvedOfferUnitPrice(
  value: string,
  decimalPlaces = PO_LINE_OFFER_UNIT_PRICE_DECIMAL_PLACES
): string {
  return normalizeDocumentDecimalInput(value, decimalPlaces);
}

/** PO offer unit price from picker: item purchase rate (not inventory standard cost). */
export function resolvePoLinePickerOfferUnitPrice(
  purchasePrice: string | null | undefined,
  decimalPlaces = PO_LINE_OFFER_UNIT_PRICE_DECIMAL_PLACES
): string {
  const positive = parsePositivePrice(purchasePrice);
  return positive ? formatResolvedOfferUnitPrice(positive, decimalPlaces) : "0";
}

/** Supplier catalog price wins; otherwise item master purchase rate. */
export function resolvePoLineOfferUnitPrice(
  supplierPrice: string | null | undefined,
  purchasePrice: string | null | undefined,
  decimalPlaces = PO_LINE_OFFER_UNIT_PRICE_DECIMAL_PLACES
): string {
  const positive = parsePositivePrice(supplierPrice);
  if (positive) return formatResolvedOfferUnitPrice(positive, decimalPlaces);
  return resolvePoLinePickerOfferUnitPrice(purchasePrice, decimalPlaces);
}

export async function fetchSupplierVariantPrice(
  supabase: SupabaseClient,
  tenantId: string,
  supplierId: string,
  variantId: string
): Promise<string | null> {
  if (!supplierId.trim() || !variantId.trim()) return null;

  const { data: variantRow, error: variantError } = await supabase
    .from("item_variants")
    .select(`id, item_id, ${VARIANT_ITEM_EMBED} (id, custom_fields)`)
    .eq("tenant_id", tenantId)
    .eq("id", variantId)
    .eq("is_active", true)
    .maybeSingle();

  if (variantError || !variantRow) return null;

  const itemId = variantRow.item_id as string;
  const item = Array.isArray(variantRow.items) ? variantRow.items[0] : variantRow.items;
  const itemPurchasePrice = extractDefaultPurchasePriceFromCustomFieldsRecord(
    (item as { custom_fields?: Record<string, unknown> } | null)?.custom_fields ?? null
  );

  const { data, error } = await supabase
    .from("supplier_items")
    .select("supplier_price, variant_id")
    .eq("tenant_id", tenantId)
    .eq("supplier_id", supplierId)
    .eq("item_id", itemId)
    .or(`variant_id.eq.${variantId},variant_id.is.null`)
    .order("variant_id", { ascending: false, nullsFirst: false })
    .limit(5);

  if (!error && data?.length) {
    const variantMatch = data.find((row) => row.variant_id === variantId);
    const fallback = data.find((row) => row.variant_id == null);
    const price = variantMatch?.supplier_price ?? fallback?.supplier_price;
    if (price != null) {
      return String(price);
    }
  }

  return parsePositivePrice(itemPurchasePrice);
}
