import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isItemClassification } from "@/lib/products/classification-labels";
import {
  isItemCostingMethod,
  isItemSource,
  isItemStatus,
  isItemTrackingMode,
  isItemType,
  parseItemBoolean,
  type ItemCostingMethod,
  type ItemSource,
  type ItemStatus,
  type ItemTrackingMode,
  type ItemType,
} from "@/lib/products/item-model";
import { redactProductListRows } from "@/lib/products/field-permissions";
import { resolveProductMediaSignedUrls } from "@/lib/products/media";
import { pickPrimaryImageStoragePath } from "@/lib/products/primary-image";
import { normalizeTaxCategory } from "@/lib/products/tax-options";
import {
  extractDefaultPurchasePriceFromCustomFieldsRecord,
  extractDefaultSellingPriceFromCustomFieldsRecord,
  extractMrpFromCustomFieldsRecord,
  extractReorderPointFromCustomFieldsRecord,
} from "@/lib/products/catalog-reserved-fields";
import { parseCustomFields } from "@/lib/products/sku-mask";
import { parseAttributeTemplates } from "@/lib/categories/tree";
import { isProductVariantStrategy, type ProductVariantStrategy } from "@/lib/products/variant-strategy";
import type { ProductPeekSection } from "@/lib/products/types";
import { resolvePeekFocusVariantIds } from "@/lib/products/peek-panels";
import type {
  ProductDetailSnapshot,
  ProductListRow,
  ProductMediaSnapshot,
  ProductStorefrontVisibilitySnapshot,
  ProductTagSnapshot,
  ProductValuationSnapshot,
  ProductVariantCountSummary,
  ProductVariantSnapshot,
} from "@/lib/products/types";

type VariantRow = {
  id: string;
  sku: string;
  barcode: string | null;
  variant_attributes: Record<string, unknown> | null;
  is_master?: boolean;
  is_sellable?: boolean;
  created_at: string;
  dead_weight_kg: number | string | null;
  volume: number | string | null;
  length_cm: number | string | null;
  width_cm: number | string | null;
  height_cm: number | string | null;
  is_active: boolean;
  price: number | string | null;
};

type ItemRow = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  classification: string;
  base_unit_of_measure: string;
  category_id: string | null;
  hsn_sac_code: string | null;
  is_purchasable: boolean;
  is_salable: boolean;
  has_variants: boolean;
  variant_strategy?: string;
  variant_axes?: unknown;
  extra_sku_options?: unknown;
  item_type?: string | null;
  track_inventory?: boolean | null;
  status?: string | null;
  needs_review?: boolean | null;
  source?: string | null;
  costing_method?: string | null;
  standard_cost?: number | string | null;
  tracking_mode?: string | null;
  is_bundle?: boolean | null;
  price_is_tax_inclusive?: boolean | null;
  default_tax_category: string;
  tax_code_id?: string | null;
  is_returnable: boolean;
  is_active: boolean;
  custom_fields: Record<string, unknown> | null;
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
  variant_id: string | null;
  supplier_id: string;
  supplier_price: number | string;
  is_preferred: boolean;
  entities: { name: string } | { name: string }[] | null;
};

type ValuationRow = {
  location_id: string;
  variant_id: string | null;
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

function pickMasterVariant(variants: VariantRow[] | null | undefined): VariantRow | null {
  if (!variants?.length) return null;
  const master = variants.find((variant) => variant.is_master);
  if (master) return master;
  return [...variants].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )[0];
}

function pickDefaultVariant(variants: VariantRow[] | null | undefined): VariantRow | null {
  if (!variants?.length) return null;
  const sellable = variants.filter((variant) => variant.is_sellable !== false);
  const pool = sellable.length ? sellable : variants;
  const master = pool.find((variant) => variant.is_master);
  if (master) return master;
  return [...pool].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )[0];
}

function pickVariantForDetail(
  variants: VariantRow[],
  preferredVariantId?: string | null
): VariantRow | null {
  if (!variants.length) return null;
  const preferred = preferredVariantId?.trim();
  if (preferred) {
    const match = variants.find((variant) => variant.id === preferred);
    if (match) return match;
  }
  // Item-level peek/edit (no variant in URL): anchor on the master row, not a sellable child.
  return pickMasterVariant(variants) ?? pickDefaultVariant(variants);
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
  baseUom: string,
  preferredCode?: string | null
): ItemUomRow | null {
  if (!rows?.length) return null;
  const preferred = preferredCode?.trim();
  if (preferred && preferred !== baseUom.trim()) {
    const match = rows.find((row) => row.uom_code === preferred);
    if (match) return match;
  }
  return rows.find((row) => row.uom_code !== baseUom) ?? null;
}

async function fetchItemUomsForProduct(
  supabase: SupabaseClient,
  tenantId: string,
  itemId: string
): Promise<ItemUomRow[]> {
  const { data, error } = await supabase
    .from("item_uoms")
    .select("uom_code, conversion_factor")
    .eq("tenant_id", tenantId)
    .eq("item_id", itemId);

  if (error || !data) return [];
  return data as ItemUomRow[];
}

function mapItemAlternateUoms(itemUoms: ItemUomRow[] | null | undefined) {
  return (itemUoms ?? []).map((entry) => ({
    uom_code: entry.uom_code,
    conversion_factor: formatDecimal(entry.conversion_factor, "1"),
  }));
}

function pickPreferredSupplier(
  rows: SupplierItemRow[] | null | undefined
): SupplierItemRow | null {
  if (!rows?.length) return null;
  return rows.find((row) => row.is_preferred) ?? rows[0] ?? null;
}

function pickPreferredSupplierForVariant(
  rows: SupplierItemRow[] | null | undefined,
  variantId: string
): SupplierItemRow | null {
  if (!rows?.length) return null;
  const variantRows = rows.filter((row) => row.variant_id === variantId);
  const itemRows = rows.filter((row) => row.variant_id == null);
  return (
    pickPreferredSupplier(variantRows.length ? variantRows : itemRows) ??
    pickPreferredSupplier(rows)
  );
}

function buildVariantPurchaseMap(
  rows: SupplierItemRow[] | null | undefined
): Map<string, { price: string; supplierName: string | null }> {
  const map = new Map<string, { price: string; supplierName: string | null }>();
  if (!rows?.length) return map;

  const variantIds = new Set(
    rows.map((row) => row.variant_id).filter((id): id is string => Boolean(id))
  );
  for (const variantId of variantIds) {
    const match = pickPreferredSupplierForVariant(rows, variantId);
    if (match) {
      map.set(variantId, {
        price: formatDecimal(match.supplier_price),
        supplierName: resolveEntityName(match.entities),
      });
    }
  }
  return map;
}

type TagAssignmentRow = {
  tag_id: string;
  tags: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;
};

type StorefrontItemRow = {
  storefront_id: string;
  is_visible: boolean;
  store_custom_name: string | null;
  store_price_book_id: string | null;
  storefront_channels?:
    | { id: string; name: string; channel_type: string }
    | { id: string; name: string; channel_type: string }[]
    | null;
};

function mapStorefrontVisibility(rows: StorefrontItemRow[] | null | undefined): ProductStorefrontVisibilitySnapshot[] {
  if (!rows?.length) return [];

  return rows
    .map((row) => {
      const channel = row.storefront_channels
        ? Array.isArray(row.storefront_channels)
          ? row.storefront_channels[0]
          : row.storefront_channels
        : null;
      return {
        storefront_id: row.storefront_id,
        storefront_name: channel?.name ?? "",
        channel_type: channel?.channel_type ?? "",
        is_visible: row.is_visible,
        store_custom_name: row.store_custom_name,
        store_price_book_id: row.store_price_book_id,
      };
    });
}

async function fetchProductTags(
  supabase: SupabaseClient,
  tenantId: string,
  itemId: string
): Promise<ProductTagSnapshot[]> {
  const { data, error } = await supabase
    .from("item_tag_assignments")
    .select(
      `
      tag_id,
      tags ( id, name, slug )
    `
    )
    .eq("tenant_id", tenantId)
    .eq("item_id", itemId);

  if (error || !data) return [];

  return (data as TagAssignmentRow[])
    .map((row) => resolveTagRow(row.tags))
    .filter((row): row is ProductTagSnapshot => row !== null);
}

function resolveTagRow(raw: TagAssignmentRow["tags"]): ProductTagSnapshot | null {
  if (!raw) return null;
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row) return null;
  return { id: row.id, name: row.name, slug: row.slug };
}

async function fetchProductStorefrontVisibility(
  supabase: SupabaseClient,
  tenantId: string,
  itemId: string
): Promise<ProductStorefrontVisibilitySnapshot[]> {
  const { data, error } = await supabase
    .from("storefront_items")
    .select(
      `
      storefront_id,
      is_visible,
      store_custom_name,
      store_price_book_id
    `
    )
    .eq("tenant_id", tenantId)
    .eq("item_id", itemId);

  if (error || !data) return [];
  return mapStorefrontVisibility(data as StorefrontItemRow[]);
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

function cloneVariantAttributes(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
}

function mapVariantRow(
  row: VariantRow,
  masterVariantId: string,
  purchaseByVariant?: Map<string, { price: string; supplierName: string | null }>
): ProductVariantSnapshot {
  const purchase = purchaseByVariant?.get(row.id);
  return {
    id: row.id,
    sku: row.sku,
    barcode: row.barcode,
    variant_attributes: cloneVariantAttributes(row.variant_attributes),
    dead_weight_kg: formatDecimal(row.dead_weight_kg, "0"),
    volume: formatDecimal(row.volume, "0"),
    length_cm: formatDecimal(row.length_cm, "0"),
    width_cm: formatDecimal(row.width_cm, "0"),
    height_cm: formatDecimal(row.height_cm, "0"),
    is_active: row.is_active,
    is_master: row.is_master ?? row.id === masterVariantId,
    is_sellable: row.is_sellable ?? true,
    price: formatDecimal(row.price, "0"),
    purchase_price: purchase?.price ?? null,
    supplier_name: purchase?.supplierName ?? null,
    created_at: row.created_at,
  };
}

async function fetchProductMedia(
  supabase: SupabaseClient,
  tenantId: string,
  itemId: string,
  options?: { signScope?: "all" | "primary" }
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
  const signScope = options?.signScope ?? "all";
  const primaryPath = pickPrimaryImageStoragePath(rows);
  const pathsToSign =
    signScope === "primary"
      ? primaryPath
        ? [primaryPath]
        : []
      : rows.map((row) => row.storage_url);
  const signedUrls = await resolveProductMediaSignedUrls(supabase, pathsToSign);

  return rows.map((row) => ({
    id: row.id,
    item_id: row.item_id,
    variant_id: row.variant_id,
    storage_url: row.storage_url,
    preview_url:
      signScope === "primary"
        ? row.storage_url === primaryPath
          ? signedUrls.get(row.storage_url) ?? null
          : null
        : signedUrls.get(row.storage_url) ?? null,
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

type ValuationPeekRow = {
  location_id: string;
  variant_id: string | null;
  total_quantity_on_hand: number | string;
  current_average_cost: number | string;
  tenant_locations?: { name: string } | { name: string }[] | null;
};

function mapPeekValuations(
  rows: ValuationPeekRow[] | null | undefined
): ProductValuationSnapshot[] {
  if (!rows?.length) return [];

  return rows.map((row) => ({
    location_id: row.location_id,
    location_name: row.tenant_locations
      ? resolveLocationName(row.tenant_locations)
      : "",
    total_quantity_on_hand: formatDecimal(row.total_quantity_on_hand, "0"),
    current_average_cost: formatDecimal(row.current_average_cost, "0"),
  }));
}

function mapListRow(
  row: ItemRow,
  commerce?: { selling_price: string | null; purchase_price: string | null; supplier_name: string | null },
  imageUrl?: string | null,
  stockOnHand?: string | null
): ProductListRow | null {
  if (!isItemClassification(row.classification)) return null;
  const variant = pickDefaultVariant(row.item_variants);
  const taxCategory = normalizeTaxCategory(row.default_tax_category);

  return {
    id: row.id,
    name: row.name,
    image_url: imageUrl ?? null,
    description: row.description,
    classification: row.classification,
    base_unit_of_measure: row.base_unit_of_measure,
    category_id: row.category_id,
    category_name: resolveCategoryName(row.item_categories),
    hsn_sac_code: row.hsn_sac_code,
    has_variants: row.has_variants,
    default_tax_category: taxCategory,
    is_active: row.is_active,
    is_purchasable: row.is_purchasable,
    is_salable: row.is_salable,
    is_returnable: row.is_returnable,
    default_variant_id: variant?.id ?? null,
    default_sku: variant?.sku ?? null,
    barcode: variant?.barcode ?? null,
    selling_price: commerce?.selling_price ?? null,
    mrp: null,
    purchase_price: commerce?.purchase_price ?? null,
    supplier_name: commerce?.supplier_name ?? null,
    stock_on_hand: stockOnHand ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function groupPriceEntriesByItem(
  rows: Array<PriceBookEntryRow & { item_id: string }> | null | undefined
): Map<string, PriceBookEntryRow[]> {
  const grouped = new Map<string, PriceBookEntryRow[]>();
  for (const row of rows ?? []) {
    const list = grouped.get(row.item_id) ?? [];
    list.push(row);
    grouped.set(row.item_id, list);
  }
  return grouped;
}

function groupSupplierItemsByItem(
  rows: Array<SupplierItemRow & { item_id: string }> | null | undefined
): Map<string, SupplierItemRow[]> {
  const grouped = new Map<string, SupplierItemRow[]>();
  for (const row of rows ?? []) {
    const list = grouped.get(row.item_id) ?? [];
    list.push(row);
    grouped.set(row.item_id, list);
  }
  return grouped;
}

async function fetchListPrimaryImagesByItemId(
  supabase: SupabaseClient,
  tenantId: string,
  rows: ItemRow[]
): Promise<Map<string, string | null>> {
  const images = new Map<string, string | null>();
  if (!rows.length) return images;

  const itemIds = rows.map((row) => row.id);
  const { data, error } = await supabase
    .from("item_media")
    .select("item_id, variant_id, storage_url, sort_order, is_primary")
    .eq("tenant_id", tenantId)
    .in("item_id", itemIds);

  if (error || !data?.length) {
    for (const itemId of itemIds) images.set(itemId, null);
    return images;
  }

  const mediaByItem = new Map<string, MediaRow[]>();
  for (const row of data as MediaRow[]) {
    const list = mediaByItem.get(row.item_id) ?? [];
    list.push(row);
    mediaByItem.set(row.item_id, list);
  }

  const storagePathByItem = new Map<string, string>();
  for (const row of rows) {
    const defaultVariantId = pickDefaultVariant(row.item_variants)?.id ?? null;
    const storagePath = pickPrimaryImageStoragePath(
      mediaByItem.get(row.id) ?? [],
      defaultVariantId,
      row.item_variants ?? undefined
    );
    if (storagePath) {
      storagePathByItem.set(row.id, storagePath);
    } else {
      images.set(row.id, null);
    }
  }

  const signedUrls = await resolveProductMediaSignedUrls(
    supabase,
    [...new Set(storagePathByItem.values())]
  );

  for (const [itemId, storagePath] of storagePathByItem) {
    images.set(itemId, signedUrls.get(storagePath) ?? null);
  }

  return images;
}

async function fetchListCommerceByItemId(
  supabase: SupabaseClient,
  tenantId: string,
  itemIds: string[]
): Promise<
  Map<string, { selling_price: string | null; purchase_price: string | null; supplier_name: string | null }>
> {
  const commerce = new Map<
    string,
    { selling_price: string | null; purchase_price: string | null; supplier_name: string | null }
  >();
  if (!itemIds.length) return commerce;

  const [{ data: priceEntries }, { data: supplierItems }] = await Promise.all([
    supabase
      .from("price_book_entries")
      .select(
        `
        item_id,
        price,
        uom_code,
        min_quantity,
        price_books ( id, is_active, created_at )
      `
      )
      .eq("tenant_id", tenantId)
      .in("item_id", itemIds),
    supabase
      .from("supplier_items")
      .select(
        `
        item_id,
        supplier_id,
        supplier_price,
        is_preferred,
        entities!supplier_items_supplier_id_fkey ( name )
      `
      )
      .eq("tenant_id", tenantId)
      .in("item_id", itemIds),
  ]);

  const pricesByItem = groupPriceEntriesByItem(
    priceEntries as Array<PriceBookEntryRow & { item_id: string }> | null
  );
  const suppliersByItem = groupSupplierItemsByItem(
    supplierItems as Array<SupplierItemRow & { item_id: string }> | null
  );

  for (const itemId of itemIds) {
    const priceEntry = pickDefaultPriceEntry(pricesByItem.get(itemId));
    const preferredSupplier = pickPreferredSupplier(suppliersByItem.get(itemId));
    commerce.set(itemId, {
      selling_price: priceEntry ? formatDecimal(priceEntry.price) : null,
      purchase_price: preferredSupplier ? formatDecimal(preferredSupplier.supplier_price) : null,
      supplier_name: preferredSupplier ? resolveEntityName(preferredSupplier.entities) : null,
    });
  }

  return commerce;
}

const VARIANT_DETAIL_SELECT = `
  id,
  sku,
  barcode,
  variant_attributes,
  is_master,
  is_sellable,
  created_at,
  dead_weight_kg,
  volume,
  length_cm,
  width_cm,
  height_cm,
  is_active,
  price
`;

/** Lean item projection for peek drawer — omits fields not rendered in essentials. */
const PEEK_ITEM_DETAIL_SELECT = `
  id,
  name,
  classification,
  base_unit_of_measure,
  category_id,
  hsn_sac_code,
  is_purchasable,
  is_salable,
  has_variants,
  variant_strategy,
  variant_axes,
  extra_sku_options,
  item_type,
  track_inventory,
  status,
  needs_review,
  source,
  costing_method,
  standard_cost,
  tracking_mode,
  is_bundle,
  price_is_tax_inclusive,
  default_tax_category,
  tax_code_id,
  is_returnable,
  is_active,
  custom_fields,
  created_at,
  updated_at,
  item_categories ( name )
`;

const ITEM_DETAIL_SELECT = `
  id,
  name,
  code,
  description,
  classification,
  base_unit_of_measure,
  category_id,
  hsn_sac_code,
  is_purchasable,
  is_salable,
  has_variants,
  variant_strategy,
  variant_axes,
  extra_sku_options,
  item_type,
  track_inventory,
  status,
  needs_review,
  source,
  costing_method,
  standard_cost,
  tracking_mode,
  is_bundle,
  price_is_tax_inclusive,
  default_tax_category,
  tax_code_id,
  is_returnable,
  is_active,
  custom_fields,
  created_at,
  updated_at,
  item_categories ( name )
`;

/** Disambiguate composite tenant FK — PostgREST rejects bare `item_variants` embeds. */
export const ITEM_VARIANTS_EMBED = "item_variants!item_variants_item_tenant_fk";

export async function fetchProductVariants(
  supabase: SupabaseClient,
  tenantId: string,
  itemId: string
): Promise<VariantRow[]> {
  const { data, error } = await supabase
    .from("item_variants")
    .select(VARIANT_DETAIL_SELECT)
    .eq("tenant_id", tenantId)
    .eq("item_id", itemId)
    .order("created_at");

  if (error || !data) return [];
  return data as VariantRow[];
}

async function fetchAggregateStockByItemId(
  supabase: SupabaseClient,
  tenantId: string,
  itemIds: string[]
): Promise<Map<string, string>> {
  const totals = new Map<string, string>();
  if (!itemIds.length) return totals;

  const { data, error } = await supabase
    .from("item_valuations")
    .select("item_id, total_quantity_on_hand")
    .eq("tenant_id", tenantId)
    .in("item_id", itemIds);

  if (error || !data?.length) return totals;

  const sums = new Map<string, number>();
  for (const row of data as Array<{ item_id: string; total_quantity_on_hand: number | string }>) {
    const current = sums.get(row.item_id) ?? 0;
    sums.set(row.item_id, current + Number(row.total_quantity_on_hand));
  }

  for (const [itemId, total] of sums) {
    totals.set(itemId, formatDecimal(total, "0"));
  }

  return totals;
}

export async function fetchProductListRows(
  supabase: SupabaseClient,
  tenantId: string,
  permissions?: { allowedFields: readonly string[] },
  options?: { includeImages?: boolean }
): Promise<ProductListRow[]> {
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
      has_variants,
      default_tax_category,
      is_returnable,
      is_purchasable,
      is_salable,
      is_active,
      created_at,
      updated_at,
      item_categories ( name ),
      ${ITEM_VARIANTS_EMBED} ( id, sku, barcode, is_master, created_at )
    `
    )
    .eq("tenant_id", tenantId)
    .order("name");

  if (error || !data) return [];

  const rows = data as ItemRow[];
  const itemIds = rows.map((row) => row.id);
  const includeImages = options?.includeImages ?? true;
  const [commerceByItem, imagesByItem, stockByItem] = await Promise.all([
    fetchListCommerceByItemId(supabase, tenantId, itemIds),
    includeImages
      ? fetchListPrimaryImagesByItemId(supabase, tenantId, rows)
      : Promise.resolve(new Map<string, string | null>()),
    fetchAggregateStockByItemId(supabase, tenantId, itemIds),
  ]);

  const mapped = rows
    .map((row) =>
      mapListRow(
        row,
        commerceByItem.get(row.id),
        imagesByItem.get(row.id),
        stockByItem.get(row.id) ?? "0"
      )
    )
    .filter((row): row is ProductListRow => row !== null);

  return permissions
    ? redactProductListRows(mapped, permissions.allowedFields)
    : mapped;
}

export type FetchProductDetailOptions = {
  variantId?: string | null;
  scope?: "peek" | "full";
  peekSections?: ProductPeekSection[];
};

const VARIANT_PEEK_INDEX_SELECT = "id, is_master, is_sellable, created_at";

async function fetchVariantPeekIndex(
  supabase: SupabaseClient,
  tenantId: string,
  itemId: string
): Promise<Array<{ id: string; is_master?: boolean | null; is_sellable?: boolean | null; created_at: string }>> {
  const { data, error } = await supabase
    .from("item_variants")
    .select(VARIANT_PEEK_INDEX_SELECT)
    .eq("tenant_id", tenantId)
    .eq("item_id", itemId)
    .order("created_at");

  if (error || !data) return [];
  return data as Array<{
    id: string;
    is_master?: boolean | null;
    is_sellable?: boolean | null;
    created_at: string;
  }>;
}

function shouldFetchPeekValuations(row: ItemRow): boolean {
  if (row.item_type !== "PHYSICAL") return false;
  if (row.is_bundle) return false;
  return parseItemBoolean(row.track_inventory, true);
}

export async function fetchProductPeekSection(
  supabase: SupabaseClient,
  tenantId: string,
  itemId: string,
  section: ProductPeekSection,
  variantId?: string | null
): Promise<Partial<ProductDetailSnapshot> | null> {
  if (section === "variants") {
    const bundle = await fetchProductVariantReload(supabase, tenantId, itemId);
    if (!bundle) return null;
    return {
      variants: bundle.variants,
      variant_axes: bundle.variant_axes,
      has_variants: bundle.has_variants,
      updated_at: bundle.updated_at,
    };
  }

  if (section === "media") {
    const media = await fetchProductMedia(supabase, tenantId, itemId, { signScope: "all" });
    return { media };
  }

  const [tags, storefrontVisibility] = await Promise.all([
    fetchProductTags(supabase, tenantId, itemId),
    fetchProductStorefrontVisibility(supabase, tenantId, itemId),
  ]);

  void variantId;
  return { tags, storefront_visibility: storefrontVisibility };
}

function assemblePeekEssentialsSnapshot(
  row: ItemRow,
  focusVariantRows: VariantRow[],
  variant: VariantRow,
  variant_count_summary: ProductVariantCountSummary,
  itemUoms: ItemUomRow[] = []
): ProductDetailSnapshot {
  const taxCategory = normalizeTaxCategory(row.default_tax_category);
  const sortedVariants = [...focusVariantRows].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const masterVariantId =
    sortedVariants.find((entry) => entry.is_master)?.id ?? sortedVariants[0]?.id ?? variant.id;
  const variants = sortedVariants.map((entry) => mapVariantRow(entry, masterVariantId));

  const rawCustomFields =
    row.custom_fields && typeof row.custom_fields === "object"
      ? (row.custom_fields as Record<string, unknown>)
      : {};
  const parsedCustomFields = parseCustomFields(rawCustomFields);

  const masterVariantRow =
    pickMasterVariant(sortedVariants) ?? sortedVariants[0] ?? variant;

  const focusedVariant = sortedVariants.find((entry) => entry.id === variant.id) ?? variant;
  const alternateUoms = mapItemAlternateUoms(itemUoms);
  const purchaseUomRow = pickAlternatePurchaseUom(
    itemUoms,
    row.base_unit_of_measure,
    parsedCustomFields.defaultPurchaseUom
  );

  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    classification: isItemClassification(row.classification)
      ? row.classification
      : "PHYSICAL_GOOD",
    base_unit_of_measure: row.base_unit_of_measure,
    category_id: row.category_id,
    category_name: resolveCategoryName(row.item_categories),
    hsn_sac_code: row.hsn_sac_code,
    is_purchasable: row.is_purchasable,
    is_salable: row.is_salable,
    has_variants: row.has_variants,
    variant_strategy: isProductVariantStrategy(row.variant_strategy ?? "")
      ? (row.variant_strategy as ProductVariantStrategy)
      : "SINGLE_SKU",
    variant_axes: Array.isArray(row.variant_axes)
      ? (row.variant_axes as unknown[]).filter(
          (entry): entry is string => typeof entry === "string" && entry.trim() !== ""
        )
      : [],
    extra_sku_options: parseAttributeTemplates(row.extra_sku_options),
    item_type: isItemType(row.item_type ?? "")
      ? (row.item_type as ItemType)
      : "PHYSICAL",
    track_inventory: parseItemBoolean(row.track_inventory, true),
    status: isItemStatus(row.status ?? "") ? (row.status as ItemStatus) : "ACTIVE",
    needs_review: row.needs_review ?? false,
    source: isItemSource(row.source ?? "") ? (row.source as ItemSource) : "MANUAL",
    costing_method: isItemCostingMethod(row.costing_method ?? "")
      ? (row.costing_method as ItemCostingMethod)
      : "WEIGHTED_AVG",
    standard_cost: formatDecimal(row.standard_cost, ""),
    tracking_mode: isItemTrackingMode(row.tracking_mode ?? "")
      ? (row.tracking_mode as ItemTrackingMode)
      : "NONE",
    is_bundle: row.is_bundle ?? false,
    price_is_tax_inclusive: row.price_is_tax_inclusive ?? false,
    default_tax_category: taxCategory,
    tax_code_id: row.tax_code_id ?? null,
    is_returnable: row.is_returnable,
    is_active: row.is_active,
    variant_id: variant.id,
    sku: variant.sku,
    barcode: variant.barcode,
    variant_attributes: cloneVariantAttributes(variant.variant_attributes),
    dead_weight_kg: formatDecimal(masterVariantRow.dead_weight_kg, "0"),
    volume: formatDecimal(masterVariantRow.volume, "0"),
    length_cm: formatDecimal(masterVariantRow.length_cm, "0"),
    width_cm: formatDecimal(masterVariantRow.width_cm, "0"),
    height_cm: formatDecimal(masterVariantRow.height_cm, "0"),
    variant_is_active: masterVariantRow.is_active,
    selling_price:
      formatDecimal(focusedVariant.price, "") ||
      extractDefaultSellingPriceFromCustomFieldsRecord(rawCustomFields),
    mrp: extractMrpFromCustomFieldsRecord(rawCustomFields),
    reorder_point: extractReorderPointFromCustomFieldsRecord(rawCustomFields),
    selling_uom: parsedCustomFields.defaultSellingUom ?? row.base_unit_of_measure,
    purchase_uom: purchaseUomRow?.uom_code ?? row.base_unit_of_measure,
    purchase_uom_conversion: purchaseUomRow
      ? formatDecimal(purchaseUomRow.conversion_factor, "1")
      : "1",
    purchase_price: extractDefaultPurchasePriceFromCustomFieldsRecord(rawCustomFields),
    supplier_id: null,
    supplier_name: null,
    valuations: [],
    variants,
    media: [],
    sku_mask: parsedCustomFields.sku_mask,
    custom_fields: parsedCustomFields.entries,
    alternate_uoms: alternateUoms,
    tags: [],
    storefront_visibility: [],
    detail_scope: "peek",
    variant_count_summary,
    peek_loaded_sections: [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function fetchProductPeekValuations(
  supabase: SupabaseClient,
  tenantId: string,
  itemId: string,
  preferredVariantId?: string | null,
  skipEligibilityCheck = false
): Promise<ProductValuationSnapshot[]> {
  if (!skipEligibilityCheck) {
    const { data: row, error } = await supabase
      .from("items")
      .select("item_type, is_bundle, track_inventory")
      .eq("tenant_id", tenantId)
      .eq("id", itemId)
      .maybeSingle();

    if (error || !row || !shouldFetchPeekValuations(row as ItemRow)) return [];
  }

  const preferred = preferredVariantId?.trim();
  let valuationQuery = supabase
    .from("item_valuations")
    .select(
      `
        location_id,
        variant_id,
        total_quantity_on_hand,
        current_average_cost,
        tenant_locations ( name )
      `
    )
    .eq("tenant_id", tenantId)
    .eq("item_id", itemId);

  if (preferred) {
    valuationQuery = valuationQuery.eq("variant_id", preferred);
  }

  const { data: valuations } = await valuationQuery
    .order("total_quantity_on_hand", { ascending: false })
    .limit(24);

  return mapPeekValuations(valuations as ValuationPeekRow[] | null);
}

async function fetchProductPeekEssentials(
  supabase: SupabaseClient,
  tenantId: string,
  itemId: string,
  preferredVariantId?: string | null
): Promise<ProductDetailSnapshot | null> {
  const preferred = preferredVariantId?.trim();

  if (preferred) {
    const [{ data, error }, { data: variantRows, error: variantError }, itemUoms] =
      await Promise.all([
        supabase
          .from("items")
          .select(PEEK_ITEM_DETAIL_SELECT)
          .eq("tenant_id", tenantId)
          .eq("id", itemId)
          .maybeSingle(),
        supabase
          .from("item_variants")
          .select(VARIANT_DETAIL_SELECT)
          .eq("tenant_id", tenantId)
          .eq("item_id", itemId)
          .or(`id.eq.${preferred},is_master.eq.true`)
          .order("created_at"),
        fetchItemUomsForProduct(supabase, tenantId, itemId),
      ]);

    if (error || !data || variantError || !variantRows?.length) return null;

    const row = data as ItemRow;
    if (!isItemClassification(row.classification)) return null;

    const focusVariantRows = variantRows as VariantRow[];
    const variant = pickVariantForDetail(focusVariantRows, preferred);
    if (!variant) return null;

    const peekSellable = focusVariantRows.filter(
      (entry) => !entry.is_master && entry.is_sellable !== false
    ).length;

    return assemblePeekEssentialsSnapshot(
      row,
      focusVariantRows,
      variant,
      {
        total: row.has_variants ? Math.max(peekSellable + 1, focusVariantRows.length) : 1,
        sellable: peekSellable,
      },
      itemUoms
    );
  }

  const [{ data, error }, variantIndex, itemUoms] = await Promise.all([
    supabase
      .from("items")
      .select(PEEK_ITEM_DETAIL_SELECT)
      .eq("tenant_id", tenantId)
      .eq("id", itemId)
      .maybeSingle(),
    fetchVariantPeekIndex(supabase, tenantId, itemId),
    fetchItemUomsForProduct(supabase, tenantId, itemId),
  ]);

  if (error || !data) return null;

  const row = data as ItemRow;
  if (!isItemClassification(row.classification)) return null;

  const { focusIds, counts: variant_count_summary } = resolvePeekFocusVariantIds(
    variantIndex,
    preferredVariantId
  );

  if (!focusIds.length) return null;

  const { data: variantRows, error: variantError } = await supabase
    .from("item_variants")
    .select(VARIANT_DETAIL_SELECT)
    .eq("tenant_id", tenantId)
    .eq("item_id", itemId)
    .in("id", focusIds)
    .order("created_at");

  if (variantError || !variantRows?.length) return null;

  const focusVariantRows = variantRows as VariantRow[];
  const variant = pickVariantForDetail(focusVariantRows, preferredVariantId);
  if (!variant) return null;

  return assemblePeekEssentialsSnapshot(
    row,
    focusVariantRows,
    variant,
    variant_count_summary,
    itemUoms
  );
}

export async function fetchProductVariantReload(
  supabase: SupabaseClient,
  tenantId: string,
  itemId: string
): Promise<
  Pick<ProductDetailSnapshot, "variants" | "variant_axes" | "has_variants" | "updated_at"> | null
> {
  const [{ data: itemRow, error: itemError }, variantRows, { data: supplierItems }] = await Promise.all([
    supabase
      .from("items")
      .select("has_variants, variant_axes, updated_at")
      .eq("tenant_id", tenantId)
      .eq("id", itemId)
      .maybeSingle(),
    fetchProductVariants(supabase, tenantId, itemId),
    supabase
      .from("supplier_items")
      .select(
        `
        variant_id,
        supplier_id,
        supplier_price,
        is_preferred,
        entities!supplier_items_supplier_id_fkey ( name )
      `
      )
      .eq("tenant_id", tenantId)
      .eq("item_id", itemId),
  ]);

  if (itemError || !itemRow || !variantRows.length) return null;

  const sortedVariants = [...variantRows].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const masterVariantId =
    sortedVariants.find((entry) => entry.is_master)?.id ?? sortedVariants[0]?.id ?? "";
  const purchaseByVariant = buildVariantPurchaseMap(supplierItems as SupplierItemRow[] | null);
  const variants = sortedVariants.map((entry) =>
    mapVariantRow(entry, masterVariantId, purchaseByVariant)
  );

  return {
    has_variants: Boolean(itemRow.has_variants),
    variant_axes: Array.isArray(itemRow.variant_axes)
      ? (itemRow.variant_axes as unknown[]).filter(
          (entry): entry is string => typeof entry === "string" && entry.trim() !== ""
        )
      : [],
    variants,
    updated_at: itemRow.updated_at as string,
  };
}

export async function fetchProductDetail(
  supabase: SupabaseClient,
  tenantId: string,
  itemId: string,
  options?: FetchProductDetailOptions
): Promise<ProductDetailSnapshot | null> {
  const scope = options?.scope ?? "full";
  if (scope === "peek") {
    return fetchProductPeekEssentials(supabase, tenantId, itemId, options?.variantId);
  }

  const itemQuery = supabase
    .from("items")
    .select(ITEM_DETAIL_SELECT)
    .eq("tenant_id", tenantId)
    .eq("id", itemId)
    .maybeSingle();

  const priceQuery = supabase
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
    .eq("item_id", itemId);
  const uomQuery = supabase
    .from("item_uoms")
    .select("uom_code, conversion_factor")
    .eq("tenant_id", tenantId)
    .eq("item_id", itemId);
  const supplierQuery = supabase
    .from("supplier_items")
    .select(
      `
        variant_id,
        supplier_id,
        supplier_price,
        is_preferred,
        entities!supplier_items_supplier_id_fkey ( name )
      `
    )
    .eq("tenant_id", tenantId)
    .eq("item_id", itemId);
  const tagsQuery = fetchProductTags(supabase, tenantId, itemId);
  const storefrontQuery = fetchProductStorefrontVisibility(supabase, tenantId, itemId);
  const mediaQuery = fetchProductMedia(supabase, tenantId, itemId, { signScope: "all" });
  const variantsQuery = fetchProductVariants(supabase, tenantId, itemId);
  const valuationQuery = supabase
    .from("item_valuations")
    .select(
      `
        location_id,
        variant_id,
        total_quantity_on_hand,
        current_average_cost,
        tenant_locations ( name )
      `
    )
    .eq("tenant_id", tenantId)
    .eq("item_id", itemId)
    .order("total_quantity_on_hand", { ascending: false })
    .limit(1000);

  const [
    { data, error },
    variantRows,
    { data: priceEntries },
    { data: itemUoms },
    { data: supplierItems },
    media,
    tags,
    storefrontVisibility,
    { data: valuations },
  ] = await Promise.all([
    itemQuery,
    variantsQuery,
    priceQuery,
    uomQuery,
    supplierQuery,
    mediaQuery,
    tagsQuery,
    storefrontQuery,
    valuationQuery,
  ]);

  if (error || !data) return null;

  const row = data as ItemRow;
  if (!isItemClassification(row.classification)) return null;

  row.item_variants = variantRows.length ? variantRows : row.item_variants ?? [];

  const variant = pickVariantForDetail(row.item_variants ?? [], options?.variantId);
  if (!variant) return null;

  const taxCategory = normalizeTaxCategory(row.default_tax_category);

  const sortedVariants = [...(row.item_variants ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const masterVariantId =
    sortedVariants.find((entry) => entry.is_master)?.id ?? sortedVariants[0]?.id ?? variant.id;
  const purchaseByVariant = buildVariantPurchaseMap(
    supplierItems as SupplierItemRow[] | null
  );
  const variants = sortedVariants.map((entry) =>
    mapVariantRow(entry, masterVariantId, purchaseByVariant)
  );

  const priceEntry = pickDefaultPriceEntry(priceEntries as PriceBookEntryRow[] | null);
  const preferredSupplier = pickPreferredSupplier(supplierItems as SupplierItemRow[] | null);
  const rawCustomFields =
    row.custom_fields && typeof row.custom_fields === "object"
      ? (row.custom_fields as Record<string, unknown>)
      : {};
  const parsedCustomFields = parseCustomFields(rawCustomFields);
  const alternateUoms = mapItemAlternateUoms(itemUoms as ItemUomRow[] | null);

  const purchaseUom = pickAlternatePurchaseUom(
    itemUoms as ItemUomRow[] | null,
    row.base_unit_of_measure,
    parsedCustomFields.defaultPurchaseUom
  );

  const masterVariantRow =
    pickMasterVariant(sortedVariants) ?? sortedVariants[0] ?? variant;

  const valuationRows = valuations as ValuationRow[] | null;
  const scopedValuationRows =
    options?.variantId?.trim()
      ? valuationRows?.filter((row) => row.variant_id === options.variantId) ?? []
      : valuationRows;

  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    classification: row.classification,
    base_unit_of_measure: row.base_unit_of_measure,
    category_id: row.category_id,
    category_name: resolveCategoryName(row.item_categories),
    hsn_sac_code: row.hsn_sac_code,
    is_purchasable: row.is_purchasable,
    is_salable: row.is_salable,
    has_variants: row.has_variants,
    variant_strategy: isProductVariantStrategy(row.variant_strategy ?? "")
      ? (row.variant_strategy as ProductVariantStrategy)
      : "SINGLE_SKU",
    variant_axes: Array.isArray(row.variant_axes)
      ? (row.variant_axes as unknown[]).filter(
          (entry): entry is string => typeof entry === "string" && entry.trim() !== ""
        )
      : [],
    extra_sku_options: parseAttributeTemplates(row.extra_sku_options),
    item_type: isItemType(row.item_type ?? "")
      ? (row.item_type as ItemType)
      : "PHYSICAL",
    track_inventory: parseItemBoolean(row.track_inventory, true),
    status: isItemStatus(row.status ?? "") ? (row.status as ItemStatus) : "ACTIVE",
    needs_review: row.needs_review ?? false,
    source: isItemSource(row.source ?? "") ? (row.source as ItemSource) : "MANUAL",
    costing_method: isItemCostingMethod(row.costing_method ?? "")
      ? (row.costing_method as ItemCostingMethod)
      : "WEIGHTED_AVG",
    standard_cost: formatDecimal(row.standard_cost, ""),
    tracking_mode: isItemTrackingMode(row.tracking_mode ?? "")
      ? (row.tracking_mode as ItemTrackingMode)
      : "NONE",
    is_bundle: row.is_bundle ?? false,
    price_is_tax_inclusive: row.price_is_tax_inclusive ?? false,
    default_tax_category: taxCategory,
    tax_code_id: row.tax_code_id ?? null,
    is_returnable: row.is_returnable,
    is_active: row.is_active,
    variant_id: variant.id,
    sku: variant.sku,
    barcode: variant.barcode,
    variant_attributes: cloneVariantAttributes(variant.variant_attributes),
    dead_weight_kg: formatDecimal(masterVariantRow.dead_weight_kg, "0"),
    volume: formatDecimal(masterVariantRow.volume, "0"),
    length_cm: formatDecimal(masterVariantRow.length_cm, "0"),
    width_cm: formatDecimal(masterVariantRow.width_cm, "0"),
    height_cm: formatDecimal(masterVariantRow.height_cm, "0"),
    variant_is_active: masterVariantRow.is_active,
    selling_price: priceEntry
      ? formatDecimal(priceEntry.price, "")
      : extractDefaultSellingPriceFromCustomFieldsRecord(rawCustomFields),
    mrp: extractMrpFromCustomFieldsRecord(rawCustomFields),
    reorder_point: extractReorderPointFromCustomFieldsRecord(rawCustomFields),
    selling_uom:
      parsedCustomFields.defaultSellingUom ??
      priceEntry?.uom_code ??
      row.base_unit_of_measure,
    purchase_uom: purchaseUom?.uom_code ?? row.base_unit_of_measure,
    purchase_uom_conversion: purchaseUom
      ? formatDecimal(purchaseUom.conversion_factor, "1")
      : "1",
    purchase_price: preferredSupplier
      ? formatDecimal(preferredSupplier.supplier_price, "")
      : extractDefaultPurchasePriceFromCustomFieldsRecord(rawCustomFields),
    supplier_id: preferredSupplier?.supplier_id ?? null,
    supplier_name: preferredSupplier ? resolveEntityName(preferredSupplier.entities) : null,
    valuations: mapValuations(scopedValuationRows),
    variants,
    media,
    sku_mask: parsedCustomFields.sku_mask,
    custom_fields: parsedCustomFields.entries,
    alternate_uoms: alternateUoms,
    tags,
    storefront_visibility: storefrontVisibility,
    detail_scope: scope,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
