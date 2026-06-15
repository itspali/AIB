import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchCategoryRows } from "@/lib/categories/queries";
import { resolveEffectiveAttributeTemplates } from "@/lib/categories/tree";
import type { PoLineCatalogContext } from "@/lib/documents/catalog-line-values";
import { fetchVariantPrimaryImageUrl } from "@/lib/procurement/purchase-orders/variant-image";
import {
  extractDefaultPurchasePriceFromCustomFieldsRecord,
  extractDefaultSellingPriceFromCustomFieldsRecord,
  extractMrpFromCustomFieldsRecord,
  filterUserCustomFieldEntries,
} from "@/lib/products/catalog-reserved-fields";
import { parseDefaultPurchaseUomFromCustomFields } from "@/lib/procurement/purchase-orders/po-line-uom-options";
import { parseDefaultSellingUomFromCustomFields } from "@/lib/sales/shared/sales-line-uom-options";
import { listVariantAttributeEntries } from "@/lib/products/list-row-key";

export type { PoLineCatalogContext };

const VARIANT_ITEM_EMBED = "items!item_variants_item_tenant_fk";

function resolveJoin<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

type VariantCatalogRow = {
  id: string;
  item_id: string;
  variant_attributes: Record<string, unknown> | null;
  items:
    | {
        description: string | null;
        hsn_sac_code: string | null;
        base_unit_of_measure: string;
        custom_fields: Record<string, unknown> | null;
        category_id: string | null;
        tax_code_id: string | null;
        price_is_tax_inclusive: boolean | null;
        tax_codes:
          | {
              rate: number | string | null;
              is_variable: boolean | null;
              tax_code_components:
                | Array<{ name: string; rate: number | string; sort_order: number | null }>
                | null;
            }
          | {
              rate: number | string | null;
              is_variable: boolean | null;
              tax_code_components:
                | Array<{ name: string; rate: number | string; sort_order: number | null }>
                | null;
            }[]
          | null;
      }
    | {
        description: string | null;
        hsn_sac_code: string | null;
        base_unit_of_measure: string;
        custom_fields: Record<string, unknown> | null;
        category_id: string | null;
        tax_code_id: string | null;
        price_is_tax_inclusive: boolean | null;
        tax_codes:
          | {
              rate: number | string | null;
              is_variable: boolean | null;
              tax_code_components:
                | Array<{ name: string; rate: number | string; sort_order: number | null }>
                | null;
            }
          | {
              rate: number | string | null;
              is_variable: boolean | null;
              tax_code_components:
                | Array<{ name: string; rate: number | string; sort_order: number | null }>
                | null;
            }[]
          | null;
      }[]
    | null;
};

function mapCustomFields(raw: Record<string, unknown> | null | undefined): Record<string, string> {
  if (!raw) return {};
  const entries = Object.entries(raw).map(([key, value]) => ({
    key,
    value: value == null ? "" : String(value),
  }));
  const filtered = filterUserCustomFieldEntries(entries);
  return Object.fromEntries(filtered.map((row) => [row.key, row.value]));
}

function mapVariantAttributes(raw: Record<string, unknown> | null | undefined): Record<string, string> {
  return Object.fromEntries(listVariantAttributeEntries(raw));
}

async function resolveCatalogAttributeLabels(
  supabase: SupabaseClient,
  tenantId: string,
  categoryId: string | null | undefined
): Promise<Record<string, string>> {
  const attributeLabels: Record<string, string> = {};
  try {
    if (!categoryId) return attributeLabels;
    const categories = await fetchCategoryRows(supabase, tenantId);
    const templates = resolveEffectiveAttributeTemplates(categoryId, categories);
    for (const template of templates) {
      attributeLabels[template.key] = template.label?.trim() || template.key;
    }
  } catch {
    // Attribute labels are optional; catalog fields still load without them.
  }
  return attributeLabels;
}

type PriceBookEntryRow = {
  price: number | string | null;
  min_quantity: number | string | null;
  price_books: { is_active: boolean | null } | { is_active: boolean | null }[] | null;
};

function resolveJoinPriceBook<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function pickDefaultSellingPriceEntry(
  rows: PriceBookEntryRow[] | null | undefined
): PriceBookEntryRow | null {
  if (!rows?.length) return null;
  const activeEntries = rows.filter((row) => {
    const book = resolveJoinPriceBook(row.price_books);
    return book?.is_active !== false;
  });
  const candidates = activeEntries.length ? activeEntries : rows;
  const listPrice = candidates.find((row) => Number(row.min_quantity) === 1);
  return listPrice ?? candidates[0] ?? null;
}

async function fetchItemSellingPrice(
  supabase: SupabaseClient,
  tenantId: string,
  itemId: string,
  customFields: Record<string, unknown> | null | undefined
): Promise<string | null> {
  const { data, error } = await supabase
    .from("price_book_entries")
    .select("price, min_quantity, price_books ( is_active )")
    .eq("tenant_id", tenantId)
    .eq("item_id", itemId);

  if (!error && data?.length) {
    const entry = pickDefaultSellingPriceEntry(data as PriceBookEntryRow[]);
    if (entry?.price != null && String(entry.price).trim() !== "") {
      return String(entry.price).trim();
    }
  }

  const fallback = extractDefaultSellingPriceFromCustomFieldsRecord(customFields);
  return fallback || null;
}

export async function fetchPoLineCatalogContext(
  supabase: SupabaseClient,
  tenantId: string,
  variantId: string
): Promise<PoLineCatalogContext | null> {
  if (!variantId.trim()) return null;

  const { data, error } = await supabase
    .from("item_variants")
    .select(
      `
      id,
      item_id,
      variant_attributes,
      ${VARIANT_ITEM_EMBED}!inner (
        description,
        hsn_sac_code,
        base_unit_of_measure,
        custom_fields,
        category_id,
        tax_code_id,
        price_is_tax_inclusive,
        tax_codes (
          rate,
          is_variable,
          tax_code_components ( name, rate, sort_order )
        )
      )
    `
    )
    .eq("tenant_id", tenantId)
    .eq("id", variantId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) return null;

  const row = data as VariantCatalogRow;
  const item = resolveJoin(row.items);
  if (!item) return null;

  const taxCode = resolveJoin(item.tax_codes);
  const taxRate = taxCode?.rate != null ? Number(taxCode.rate) : 0;
  const taxComponents = (taxCode?.tax_code_components ?? [])
    .map((component) => ({
      name: String(component.name ?? "").trim(),
      rate: Number(component.rate),
      sort_order: Number(component.sort_order ?? 0),
    }))
    .filter(
      (component) =>
        component.name.length > 0 && Number.isFinite(component.rate) && component.rate >= 0
    )
    .sort((left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name));

  const [attributeLabels, imageUrl, alternateUomsResult, sellingPrice] = await Promise.all([
    resolveCatalogAttributeLabels(supabase, tenantId, item.category_id),
    fetchVariantPrimaryImageUrl(supabase, tenantId, row.item_id, row.id).catch(() => null),
    supabase
      .from("item_uoms")
      .select("uom_code, conversion_factor")
      .eq("tenant_id", tenantId)
      .eq("item_id", row.item_id),
    fetchItemSellingPrice(supabase, tenantId, row.item_id, item.custom_fields),
  ]);

  const alternate_uoms = (alternateUomsResult.data ?? [])
    .map((entry) => ({
      uom_code: String(entry.uom_code ?? "").trim(),
      conversion_factor: Number(entry.conversion_factor),
    }))
    .filter(
      (entry) =>
        entry.uom_code.length > 0 &&
        Number.isFinite(entry.conversion_factor) &&
        entry.conversion_factor > 0
    );

  const default_purchase_uom = parseDefaultPurchaseUomFromCustomFields(item.custom_fields);
  const default_selling_uom = parseDefaultSellingUomFromCustomFields(item.custom_fields);

  const mrp = extractMrpFromCustomFieldsRecord(item.custom_fields);
  const purchase_price = extractDefaultPurchasePriceFromCustomFieldsRecord(item.custom_fields);

  return {
    description: item.description?.trim() || null,
    hsn_sac_code: item.hsn_sac_code?.trim() || null,
    base_unit_of_measure: item.base_unit_of_measure?.trim() || null,
    mrp: mrp || null,
    purchase_price: purchase_price || null,
    selling_price: sellingPrice,
    image_url: imageUrl,
    tax_code_id: item.tax_code_id,
    tax_rate: Number.isFinite(taxRate) ? taxRate : 0,
    tax_is_variable: Boolean(taxCode?.is_variable),
    price_is_tax_inclusive: item.price_is_tax_inclusive === true,
    tax_components: taxComponents,
    default_purchase_uom,
    default_selling_uom,
    alternate_uoms,
    custom_fields: mapCustomFields(item.custom_fields),
    variant_attributes: mapVariantAttributes(row.variant_attributes),
    attribute_labels: attributeLabels,
    catalog_snapshot_source: "server",
  };
}
