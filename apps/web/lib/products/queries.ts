import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isItemClassification } from "@/lib/products/classification-labels";
import { resolveProductMediaSignedUrls } from "@/lib/products/media";
import { isTaxCategory } from "@/lib/products/tax-options";
import type {
  ProductDetailSnapshot,
  ProductListRow,
  ProductMediaSnapshot,
  ProductValuationSnapshot,
  ProductVariantSnapshot,
} from "@/lib/products/types";

type VariantRow = {
  id: string;
  sku: string;
  barcode: string | null;
  variant_attributes: Record<string, unknown> | null;
  created_at: string;
  dead_weight_kg: number | string | null;
  weight: number | string | null;
  volume: number | string | null;
  length_cm: number | string | null;
  width_cm: number | string | null;
  height_cm: number | string | null;
  is_active: boolean;
};

type ItemRow = {
  id: string;
  name: string;
  description: string | null;
  classification: string;
  base_unit_of_measure: string;
  category_id: string | null;
  hsn_sac_code: string | null;
  is_purchasable: boolean;
  is_salable: boolean;
  has_variants: boolean;
  default_tax_category: string;
  is_returnable: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  item_categories: { name: string } | { name: string }[] | null;
  item_variants: VariantRow[] | null;
};

type PriceBookEntryRow = {
  price: number | string;
  uom_code: string | null;
  min_quantity: number | string;
  price_books: { id: string; is_active: boolean; created_at: string } | { id: string; is_active: boolean; created_at: string }[] | null;
};

type ItemUomRow = {
  uom_code: string;
  conversion_factor: number | string;
};

type SupplierItemRow = {
  supplier_id: string;
  supplier_price: number | string;
  is_preferred: boolean;
  entities: { name: string } | { name: string }[] | null;
};

type ValuationRow = {
  location_id: string;
  total_quantity_on_hand: number | string;
  current_average_cost: number | string;
  tenant_locations: { name: string } | { name: string }[] | null;
};

function resolveCategoryName(raw: ItemRow["item_categories"]): string | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0]?.name ?? null;
  return raw.name ?? null;
}

function resolveEntityName(raw: SupplierItemRow["entities"]): string | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0]?.name ?? null;
  return raw.name ?? null;
}

function resolveLocationName(raw: ValuationRow["tenant_locations"]): string {
  if (!raw) return "Unknown location";
  if (Array.isArray(raw)) return raw[0]?.name ?? "Unknown location";
  return raw.name ?? "Unknown location";
}

function pickDefaultVariant(variants: VariantRow[] | null | undefined): VariantRow | null {
  if (!variants?.length) return null;
  return [...variants].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )[0];
}

function formatDecimal(value: number | string | null | undefined, fallback = "0"): string {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function pickDefaultPriceEntry(rows: PriceBookEntryRow[] | null | undefined): PriceBookEntryRow | null {
  if (!rows?.length) return null;

  const activeEntries = rows.filter((row) => {
    const book = Array.isArray(row.price_books) ? row.price_books[0] : row.price_books;
    return book?.is_active !== false;
  });

  const candidates = activeEntries.length ? activeEntries : rows;
  const listPrice = candidates.find((row) => Number(row.min_quantity) === 1);
  return listPrice ?? candidates[0] ?? null;
}

function pickAlternatePurchaseUom(
  rows: ItemUomRow[] | null | undefined,
  baseUom: string
): ItemUomRow | null {
  if (!rows?.length) return null;
  return rows.find((row) => row.uom_code !== baseUom) ?? null;
}

function pickPreferredSupplier(
  rows: SupplierItemRow[] | null | undefined
): SupplierItemRow | null {
  if (!rows?.length) return null;
  return rows.find((row) => row.is_preferred) ?? rows[0] ?? null;
}

type MediaRow = {
  id: string;
  item_id: string;
  variant_id: string | null;
  storage_url: string;
  sort_order: number;
  is_primary: boolean;
  show_on_storefront: boolean;
  show_in_digital_catalog: boolean;
  show_on_internal_transactions: boolean;
  created_at: string;
};

function mapVariantRow(row: VariantRow, masterVariantId: string): ProductVariantSnapshot {
  return {
    id: row.id,
    sku: row.sku,
    barcode: row.barcode,
    variant_attributes:
      row.variant_attributes && typeof row.variant_attributes === "object"
        ? row.variant_attributes
        : {},
    dead_weight_kg: formatDecimal(row.dead_weight_kg, "0"),
    weight: formatDecimal(row.weight, "0"),
    volume: formatDecimal(row.volume, "0"),
    length_cm: formatDecimal(row.length_cm, "0"),
    width_cm: formatDecimal(row.width_cm, "0"),
    height_cm: formatDecimal(row.height_cm, "0"),
    is_active: row.is_active,
    is_master: row.id === masterVariantId,
    created_at: row.created_at,
  };
}

async function fetchProductMedia(
  supabase: SupabaseClient,
  tenantId: string,
  itemId: string
): Promise<ProductMediaSnapshot[]> {
  const { data, error } = await supabase
    .from("item_media")
    .select(
      `
      id,
      item_id,
      variant_id,
      storage_url,
      sort_order,
      is_primary,
      show_on_storefront,
      show_in_digital_catalog,
      show_on_internal_transactions,
      created_at
    `
    )
    .eq("tenant_id", tenantId)
    .eq("item_id", itemId)
    .order("sort_order")
    .order("created_at");

  if (error || !data?.length) return [];

  const rows = data as MediaRow[];
  const signedUrls = await resolveProductMediaSignedUrls(
    supabase,
    rows.map((row) => row.storage_url)
  );

  return rows.map((row) => ({
    id: row.id,
    item_id: row.item_id,
    variant_id: row.variant_id,
    storage_url: row.storage_url,
    preview_url: signedUrls.get(row.storage_url) ?? null,
    sort_order: row.sort_order,
    is_primary: row.is_primary,
    show_on_storefront: row.show_on_storefront,
    show_in_digital_catalog: row.show_in_digital_catalog,
    show_on_internal_transactions: row.show_on_internal_transactions,
    created_at: row.created_at,
  }));
}

function mapValuations(rows: ValuationRow[] | null | undefined): ProductValuationSnapshot[] {
  if (!rows?.length) return [];

  return rows.map((row) => ({
    location_id: row.location_id,
    location_name: resolveLocationName(row.tenant_locations),
    total_quantity_on_hand: formatDecimal(row.total_quantity_on_hand, "0"),
    current_average_cost: formatDecimal(row.current_average_cost, "0"),
  }));
}

function mapListRow(row: ItemRow): ProductListRow | null {
  if (!isItemClassification(row.classification)) return null;
  const variant = pickDefaultVariant(row.item_variants);

  return {
    id: row.id,
    name: row.name,
    classification: row.classification,
    base_unit_of_measure: row.base_unit_of_measure,
    category_id: row.category_id,
    category_name: resolveCategoryName(row.item_categories),
    is_active: row.is_active,
    is_purchasable: row.is_purchasable,
    is_salable: row.is_salable,
    default_variant_id: variant?.id ?? null,
    default_sku: variant?.sku ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function fetchProductListRows(
  supabase: SupabaseClient,
  tenantId: string
): Promise<ProductListRow[]> {
  const { data, error } = await supabase
    .from("items")
    .select(
      `
      id,
      name,
      classification,
      base_unit_of_measure,
      category_id,
      is_purchasable,
      is_salable,
      is_active,
      created_at,
      updated_at,
      item_categories ( name ),
      item_variants ( id, sku, created_at )
    `
    )
    .eq("tenant_id", tenantId)
    .order("name");

  if (error || !data) return [];

  return (data as ItemRow[])
    .map(mapListRow)
    .filter((row): row is ProductListRow => row !== null);
}

export async function fetchProductDetail(
  supabase: SupabaseClient,
  tenantId: string,
  itemId: string
): Promise<ProductDetailSnapshot | null> {
  const { data, error } = await supabase
    .from("items")
    .select(
      `
      id,
      name,
      description,
      classification,
      base_unit_of_measure,
      category_id,
      hsn_sac_code,
      is_purchasable,
      is_salable,
      has_variants,
      default_tax_category,
      is_returnable,
      is_active,
      created_at,
      updated_at,
      item_categories ( name ),
      item_variants (
        id,
        sku,
        barcode,
        variant_attributes,
        created_at,
        dead_weight_kg,
        weight,
        volume,
        length_cm,
        width_cm,
        height_cm,
        is_active
      )
    `
    )
    .eq("tenant_id", tenantId)
    .eq("id", itemId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as ItemRow;
  if (!isItemClassification(row.classification)) return null;

  const taxCategory = isTaxCategory(row.default_tax_category)
    ? row.default_tax_category
    : "STANDARD";

  const variant = pickDefaultVariant(row.item_variants);
  if (!variant) return null;

  const [
    { data: priceEntries },
    { data: itemUoms },
    { data: supplierItems },
    { data: valuations },
    media,
  ] = await Promise.all([
    supabase
      .from("price_book_entries")
      .select(
        `
        price,
        uom_code,
        min_quantity,
        price_books ( id, is_active, created_at )
      `
      )
      .eq("tenant_id", tenantId)
      .eq("item_id", itemId),
    supabase
      .from("item_uoms")
      .select("uom_code, conversion_factor")
      .eq("tenant_id", tenantId)
      .eq("item_id", itemId),
    supabase
      .from("supplier_items")
      .select(
        `
        supplier_id,
        supplier_price,
        is_preferred,
        entities ( name )
      `
      )
      .eq("tenant_id", tenantId)
      .eq("item_id", itemId),
    supabase
      .from("item_valuations")
      .select(
        `
        location_id,
        total_quantity_on_hand,
        current_average_cost,
        tenant_locations ( name )
      `
      )
      .eq("tenant_id", tenantId)
      .eq("item_id", itemId)
      .order("total_quantity_on_hand", { ascending: false }),
    fetchProductMedia(supabase, tenantId, itemId),
  ]);

  const sortedVariants = [...(row.item_variants ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const masterVariantId = sortedVariants[0]?.id ?? variant.id;
  const variants = sortedVariants.map((entry) => mapVariantRow(entry, masterVariantId));

  const priceEntry = pickDefaultPriceEntry(priceEntries as PriceBookEntryRow[] | null);
  const purchaseUom = pickAlternatePurchaseUom(
    itemUoms as ItemUomRow[] | null,
    row.base_unit_of_measure
  );
  const preferredSupplier = pickPreferredSupplier(supplierItems as SupplierItemRow[] | null);

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    classification: row.classification,
    base_unit_of_measure: row.base_unit_of_measure,
    category_id: row.category_id,
    category_name: resolveCategoryName(row.item_categories),
    hsn_sac_code: row.hsn_sac_code,
    is_purchasable: row.is_purchasable,
    is_salable: row.is_salable,
    has_variants: row.has_variants,
    default_tax_category: taxCategory,
    is_returnable: row.is_returnable,
    is_active: row.is_active,
    variant_id: variant.id,
    sku: variant.sku,
    barcode: variant.barcode,
    variant_attributes:
      variant.variant_attributes && typeof variant.variant_attributes === "object"
        ? variant.variant_attributes
        : {},
    dead_weight_kg: formatDecimal(variant.dead_weight_kg, "0"),
    weight: formatDecimal(variant.weight, "0"),
    volume: formatDecimal(variant.volume, "0"),
    length_cm: formatDecimal(variant.length_cm, "0"),
    width_cm: formatDecimal(variant.width_cm, "0"),
    height_cm: formatDecimal(variant.height_cm, "0"),
    variant_is_active: variant.is_active,
    selling_price: priceEntry ? formatDecimal(priceEntry.price, "") : "",
    selling_uom: priceEntry?.uom_code ?? row.base_unit_of_measure,
    purchase_uom: purchaseUom?.uom_code ?? row.base_unit_of_measure,
    purchase_uom_conversion: purchaseUom
      ? formatDecimal(purchaseUom.conversion_factor, "1")
      : "1",
    purchase_price: preferredSupplier
      ? formatDecimal(preferredSupplier.supplier_price, "")
      : "",
    supplier_id: preferredSupplier?.supplier_id ?? null,
    supplier_name: preferredSupplier ? resolveEntityName(preferredSupplier.entities) : null,
    valuations: mapValuations(valuations as ValuationRow[] | null),
    variants,
    media,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
