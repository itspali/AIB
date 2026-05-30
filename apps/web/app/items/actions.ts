"use server";

import { revalidatePath } from "next/cache";
import { fetchProductCatalogContext } from "@/lib/products/commerce-queries";
import {
  fetchProductListByIds,
  fetchProductListPage,
  PRODUCT_LIST_PAGE_SIZE,
} from "@/lib/products/list-queries";
import { resolveProductMediaSignedUrls } from "@/lib/products/media";
import { fetchProductDetail } from "@/lib/products/queries";
import { resolveSessionProductFieldPermissions } from "@/lib/products/field-permissions-server";
import { productMasterSchema } from "@/lib/products/schemas";
import { buildCustomFieldsPayload } from "@/lib/products/sku-mask";
import type { ProductMasterInput } from "@/lib/products/schemas";
import { itemMediaSchema, itemVariantSchema } from "@/lib/products/variant-schemas";
import { formatRpcDeployError, isMissingRpcError } from "@/lib/supabase/rpc-error";
import { requireTenantId } from "@/lib/supabase/require-tenant";

function parseDecimal(value: string, fallback = 0): number {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseOptionalDecimal(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildVariantAttributes(raw: Record<string, string>): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const trimmedKey = key.trim();
    const trimmedValue = value.trim();
    if (!trimmedKey || !trimmedValue) continue;
    attributes[trimmedKey] = trimmedValue;
  }
  return attributes;
}

function buildAlternateUomsPayload(values: ProductMasterInput) {
  const rows = values.alternate_uoms.map((row) => ({
    uom_code: row.uom_code,
    conversion_factor: parseDecimal(row.conversion_factor, 1),
  }));

  if (values.purchase_uom !== values.base_unit_of_measure) {
    const purchaseIndex = rows.findIndex((row) => row.uom_code === values.purchase_uom);
    if (purchaseIndex >= 0) {
      rows[purchaseIndex] = {
        uom_code: values.purchase_uom,
        conversion_factor: parseDecimal(values.purchase_uom_conversion, 1),
      };
    } else {
      rows.unshift({
        uom_code: values.purchase_uom,
        conversion_factor: parseDecimal(values.purchase_uom_conversion, 1),
      });
    }
  }

  return rows;
}

function buildStorefrontItemsPayload(values: ProductMasterInput) {
  return values.storefront_visibility
    .filter(
      (row) =>
        row.is_visible ||
        row.store_custom_name.trim() ||
        row.store_price_book_id
    )
    .map((row) => ({
      storefront_id: row.storefront_id,
      is_visible: row.is_visible,
      store_custom_name: row.store_custom_name.trim() || null,
      store_price_book_id: row.store_price_book_id,
    }));
}

export async function ensureProductTag(name: string, tagGroup?: string) {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Tag name is required." };

  const { supabase } = await requireTenantId();
  const { data, error } = await supabase.rpc("ensure_tag", {
    p_name: trimmed,
    p_tag_group: tagGroup?.trim() || null,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("ensure_tag") };
    }
    return { error: error.message };
  }

  revalidatePath("/inventory/items");
  return { success: true as const, tagId: data as string };
}

export async function saveProductMasterProfile(raw: unknown) {
  const parsed = productMasterSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid product profile" };
  }

  const values = parsed.data;
  const { supabase, tenantId } = await requireTenantId();

  const { data, error } = await supabase.rpc("save_product_master_profile", {
    p_item_id: values.item_id,
    p_name: values.name,
    p_classification: values.classification,
    p_base_uom: values.base_unit_of_measure,
    p_category_id: values.category_id,
    p_sku: values.sku,
    p_description: values.description || null,
    p_is_purchasable: values.is_purchasable,
    p_is_salable: values.is_salable,
    p_is_active: values.is_active,
    p_hsn_sac_code: values.hsn_sac_code || null,
    p_has_variants: values.has_variants,
    p_default_tax_category: values.default_tax_category,
    p_is_returnable: values.is_returnable,
    p_barcode: values.barcode || null,
    p_variant_attributes: buildVariantAttributes(values.variant_attributes),
    p_dead_weight_kg: parseDecimal(values.dead_weight_kg),
    p_weight: parseOptionalDecimal(values.weight),
    p_volume: parseOptionalDecimal(values.volume),
    p_length_cm: parseDecimal(values.length_cm),
    p_width_cm: parseDecimal(values.width_cm),
    p_height_cm: parseDecimal(values.height_cm),
    p_variant_is_active: values.variant_is_active,
    p_selling_price: parseOptionalDecimal(values.selling_price),
    p_selling_uom:
      values.selling_uom !== values.base_unit_of_measure ? values.selling_uom : null,
    p_purchase_uom:
      values.purchase_uom !== values.base_unit_of_measure ? values.purchase_uom : null,
    p_purchase_uom_conversion:
      values.purchase_uom !== values.base_unit_of_measure
        ? parseDecimal(values.purchase_uom_conversion, 1)
        : null,
    p_purchase_price: parseOptionalDecimal(values.purchase_price),
    p_supplier_id: values.supplier_id,
    p_custom_fields: buildCustomFieldsPayload(values.sku_mask, values.custom_fields),
    p_alternate_uoms: buildAlternateUomsPayload(values),
    p_tag_ids: values.tag_ids,
    p_storefront_items: buildStorefrontItemsPayload(values),
    p_variant_strategy: values.variant_strategy,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("save_product_master_profile") };
    }
    if (error.message.toLowerCase().includes("sku already exists")) {
      return { error: "Master SKU is already assigned to another product in this workspace." };
    }
    return { error: error.message };
  }

  revalidatePath("/inventory/items");
  revalidatePath("/inventory/categories");

  const itemId = data as string;
  const detail = await fetchProductDetail(supabase, tenantId, itemId);

  return { success: true as const, itemId, detail };
}

export async function getProductDetail(itemId: string) {
  const { supabase, tenantId } = await requireTenantId();
  const detail = await fetchProductDetail(supabase, tenantId, itemId);
  if (!detail) return { error: "Product profile not found." };
  return { detail };
}

export async function getProductCatalogContext() {
  const { supabase, tenantId } = await requireTenantId();
  const catalogContext = await fetchProductCatalogContext(supabase, tenantId);
  return { catalogContext };
}

export async function fetchMoreProductListRows(
  offset: number,
  options?: { expandVariants?: boolean }
) {
  const { supabase, tenantId } = await requireTenantId();
  const permissions = await resolveSessionProductFieldPermissions(supabase, tenantId);

  return fetchProductListPage(supabase, tenantId, permissions ?? undefined, {
    offset,
    limit: PRODUCT_LIST_PAGE_SIZE,
    includeImages: false,
    expandVariants: options?.expandVariants,
  });
}

export async function fetchProductListByFilterIds(
  itemIds: string[],
  options?: { expandVariants?: boolean }
) {
  const { supabase, tenantId } = await requireTenantId();
  const permissions = await resolveSessionProductFieldPermissions(supabase, tenantId);

  return fetchProductListByIds(supabase, tenantId, itemIds, permissions ?? undefined, {
    includeImages: false,
    expandVariants: options?.expandVariants,
  });
}

export async function hydrateProductListImageUrls(itemIds: string[]) {
  const uniqueIds = [...new Set(itemIds.filter(Boolean))];
  if (!uniqueIds.length) return { imageUrls: {} as Record<string, string | null> };

  const { supabase, tenantId } = await requireTenantId();
  const { data, error } = await supabase
    .from("product_list_workspace_rows")
    .select("id, primary_image_storage_path")
    .eq("tenant_id", tenantId)
    .in("id", uniqueIds);

  if (error || !data?.length) {
    return { imageUrls: {} as Record<string, string | null> };
  }

  const rows = data as Array<{ id: string; primary_image_storage_path: string | null }>;
  const imageUrls: Record<string, string | null> = {};
  const pathByItem = new Map<string, string>();

  for (const row of rows) {
    const path = row.primary_image_storage_path?.trim();
    if (!path) continue;
    if (path.startsWith("http://") || path.startsWith("https://")) {
      imageUrls[row.id] = path;
      continue;
    }
    pathByItem.set(row.id, path);
  }

  const signedUrls = await resolveProductMediaSignedUrls(supabase, [...pathByItem.values()]);
  for (const [itemId, path] of pathByItem) {
    imageUrls[itemId] = signedUrls.get(path) ?? null;
  }

  return { imageUrls };
}

export type ProductListGallerySlide = {
  itemId: string;
  itemName: string;
  mediaId: string;
  url: string;
};

export async function fetchProductMediaGallery(
  itemId: string,
  itemName: string
): Promise<{ slides: ProductListGallerySlide[] }> {
  if (!itemId.trim()) return { slides: [] };

  const { supabase, tenantId } = await requireTenantId();
  const { data, error } = await supabase
    .from("item_media")
    .select("id, item_id, storage_url, sort_order, created_at")
    .eq("tenant_id", tenantId)
    .eq("item_id", itemId)
    .order("sort_order")
    .order("created_at");

  if (error || !data?.length) return { slides: [] };

  const rows = data as Array<{
    id: string;
    item_id: string;
    storage_url: string;
    sort_order: number;
    created_at: string;
  }>;

  const signedUrls = await resolveProductMediaSignedUrls(
    supabase,
    [...new Set(rows.map((row) => row.storage_url))]
  );

  const slides = rows
    .map((row) => {
      const url = signedUrls.get(row.storage_url);
      if (!url) return null;
      return {
        itemId: row.item_id,
        itemName,
        mediaId: row.id,
        url,
        sortOrder: row.sort_order,
        createdAt: row.created_at,
      };
    })
    .filter((slide): slide is NonNullable<typeof slide> => slide != null)
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder || left.createdAt.localeCompare(right.createdAt)
    )
    .map(({ itemId, itemName, mediaId, url }) => ({ itemId, itemName, mediaId, url }));

  return { slides };
}

export async function saveItemVariant(raw: unknown) {
  const parsed = itemVariantSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid variant profile" };
  }

  const values = parsed.data;
  const { supabase } = await requireTenantId();

  const { data, error } = await supabase.rpc("save_item_variant", {
    p_item_id: values.item_id,
    p_sku: values.sku,
    p_variant_id: values.variant_id,
    p_barcode: values.barcode || null,
    p_variant_attributes: buildVariantAttributes(values.variant_attributes),
    p_dead_weight_kg: parseDecimal(values.dead_weight_kg),
    p_weight: parseOptionalDecimal(values.weight),
    p_volume: parseOptionalDecimal(values.volume),
    p_length_cm: parseDecimal(values.length_cm),
    p_width_cm: parseDecimal(values.width_cm),
    p_height_cm: parseDecimal(values.height_cm),
    p_is_active: values.is_active,
    p_price: parseOptionalDecimal(values.price),
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("save_item_variant") };
    }
    if (error.message.toLowerCase().includes("sku already exists")) {
      return { error: "SKU is already assigned to another variant in this workspace." };
    }
    if (error.message.toLowerCase().includes("attribute combination")) {
      return { error: "Another variant already uses this exact attribute combination." };
    }
    return { error: error.message };
  }

  revalidatePath("/inventory/items");
  return { success: true as const, variantId: data as string };
}

export type BulkVariantRow = {
  sku: string;
  barcode?: string | null;
  price?: string | null;
  is_active?: boolean;
  variant_attributes: Record<string, string>;
};

export async function saveItemVariantsBulk(itemId: string, variants: BulkVariantRow[]) {
  if (!itemId.trim()) return { error: "Product id is required." };
  if (!variants.length) return { error: "No variants to create." };

  const { supabase } = await requireTenantId();

  const payload = variants.map((row) => ({
    sku: row.sku.trim(),
    barcode: row.barcode?.trim() || null,
    price: row.price?.trim() ? row.price.trim() : null,
    is_active: row.is_active ?? true,
    variant_attributes: buildVariantAttributes(row.variant_attributes),
  }));

  const { data, error } = await supabase.rpc("save_item_variants_bulk", {
    p_item_id: itemId,
    p_variants: payload,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("save_item_variants_bulk") };
    }
    return { error: error.message };
  }

  revalidatePath("/inventory/items");
  return { success: true as const, createdCount: (data as number) ?? payload.length };
}

export type VariantAssortmentCell = {
  variant_id: string;
  location_id: string;
  is_stocked: boolean;
  is_sellable: boolean;
  is_orderable: boolean;
};

export type VariantAssortmentData = {
  locations: Array<{
    id: string;
    name: string;
    presence_type: string;
    is_stock_holding: boolean;
  }>;
  cells: VariantAssortmentCell[];
};

export async function getVariantAssortment(
  itemId: string
): Promise<{ data: VariantAssortmentData } | { error: string }> {
  if (!itemId.trim()) return { error: "Product id is required." };

  const { supabase, tenantId } = await requireTenantId();
  const [{ data: locations, error: locError }, { data: rows, error: rowError }] = await Promise.all([
    supabase
      .from("tenant_locations")
      .select("id, name, presence_type, is_stock_holding")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("item_variant_locations")
      .select("variant_id, location_id, is_stocked, is_sellable, is_orderable")
      .eq("tenant_id", tenantId)
      .eq("item_id", itemId),
  ]);

  if (locError) return { error: locError.message };
  if (rowError) return { error: rowError.message };

  return {
    data: {
      locations: (locations ?? []) as VariantAssortmentData["locations"],
      cells: (rows ?? []) as VariantAssortmentCell[],
    },
  };
}

export async function saveVariantAssortment(itemId: string, rows: VariantAssortmentCell[]) {
  if (!itemId.trim()) return { error: "Product id is required." };

  const { supabase } = await requireTenantId();
  const { error } = await supabase.rpc("save_item_variant_locations", {
    p_item_id: itemId,
    p_rows: rows,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("save_item_variant_locations") };
    }
    return { error: error.message };
  }

  revalidatePath("/inventory/items");
  return { success: true as const };
}

export type VariantChannelCell = {
  storefront_id: string;
  variant_id: string;
  is_visible: boolean;
};

export type VariantChannelData = {
  channels: Array<{
    id: string;
    name: string;
    channel_type: string;
  }>;
  cells: VariantChannelCell[];
};

export async function getVariantChannelAvailability(
  itemId: string
): Promise<{ data: VariantChannelData } | { error: string }> {
  if (!itemId.trim()) return { error: "Product id is required." };

  const { supabase, tenantId } = await requireTenantId();
  const [{ data: channels, error: channelError }, { data: rows, error: rowError }] =
    await Promise.all([
      supabase
        .from("storefront_channels")
        .select("id, name, channel_type")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("storefront_variant_items")
        .select("storefront_id, variant_id, is_visible")
        .eq("tenant_id", tenantId)
        .eq("item_id", itemId),
    ]);

  if (channelError) return { error: channelError.message };
  if (rowError) return { error: rowError.message };

  return {
    data: {
      channels: (channels ?? []) as VariantChannelData["channels"],
      cells: (rows ?? []) as VariantChannelCell[],
    },
  };
}

export async function saveVariantChannelAvailability(itemId: string, rows: VariantChannelCell[]) {
  if (!itemId.trim()) return { error: "Product id is required." };

  const { supabase } = await requireTenantId();
  const { error } = await supabase.rpc("save_variant_channel_availability", {
    p_item_id: itemId,
    p_rows: rows,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("save_variant_channel_availability") };
    }
    return { error: error.message };
  }

  revalidatePath("/inventory/items");
  return { success: true as const };
}

export type PriceBookEntryRow = {
  price_book_id: string;
  variant_id: string | null;
  uom_code: string | null;
  min_quantity: number;
  price: number;
};

export type PriceBookEntryData = {
  books: Array<{ id: string; name: string; currency_code: string }>;
  entries: PriceBookEntryRow[];
};

export async function getPriceBookEntries(
  itemId: string
): Promise<{ data: PriceBookEntryData } | { error: string }> {
  if (!itemId.trim()) return { error: "Product id is required." };

  const { supabase, tenantId } = await requireTenantId();
  const [{ data: books, error: bookError }, { data: entries, error: entryError }] =
    await Promise.all([
      supabase
        .from("price_books")
        .select("id, name, currency_code")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("price_book_entries")
        .select("price_book_id, variant_id, uom_code, min_quantity, price")
        .eq("tenant_id", tenantId)
        .eq("item_id", itemId)
        .order("min_quantity"),
    ]);

  if (bookError) return { error: bookError.message };
  if (entryError) return { error: entryError.message };

  return {
    data: {
      books: (books ?? []) as PriceBookEntryData["books"],
      entries: ((entries ?? []) as Array<{
        price_book_id: string;
        variant_id: string | null;
        uom_code: string | null;
        min_quantity: number | string;
        price: number | string;
      }>).map((row) => ({
        price_book_id: row.price_book_id,
        variant_id: row.variant_id,
        uom_code: row.uom_code,
        min_quantity: Number(row.min_quantity),
        price: Number(row.price),
      })),
    },
  };
}

export async function savePriceBookEntries(
  itemId: string,
  priceBookId: string,
  rows: Array<{
    variant_id: string | null;
    uom_code: string | null;
    min_quantity: number;
    price: number;
  }>
) {
  if (!itemId.trim()) return { error: "Product id is required." };
  if (!priceBookId.trim()) return { error: "Price book is required." };

  const { supabase } = await requireTenantId();
  const { error } = await supabase.rpc("save_price_book_entries", {
    p_item_id: itemId,
    p_price_book_id: priceBookId,
    p_rows: rows,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("save_price_book_entries") };
    }
    return { error: error.message };
  }

  revalidatePath("/inventory/items");
  return { success: true as const };
}

export async function saveItemVariantAxes(itemId: string, axes: string[]) {
  if (!itemId.trim()) return { error: "Product id is required." };

  const { supabase } = await requireTenantId();
  const { error } = await supabase.rpc("save_item_variant_axes", {
    p_item_id: itemId,
    p_axes: axes,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("save_item_variant_axes") };
    }
    return { error: error.message };
  }

  revalidatePath("/inventory/items");
  return { success: true as const };
}

export async function deleteItemVariant(variantId: string) {
  const { supabase } = await requireTenantId();

  const { error } = await supabase.rpc("delete_item_variant", {
    p_variant_id: variantId,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("delete_item_variant") };
    }
    return { error: error.message };
  }

  revalidatePath("/inventory/items");
  return { success: true as const };
}

export async function saveItemMedia(raw: unknown) {
  const parsed = itemMediaSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid media profile" };
  }

  const values = parsed.data;
  const { supabase } = await requireTenantId();

  const { data, error } = await supabase.rpc("save_item_media", {
    p_item_id: values.item_id,
    p_storage_url: values.storage_url,
    p_media_id: values.media_id,
    p_variant_id: values.variant_id,
    p_sort_order: values.sort_order,
    p_is_primary: values.is_primary,
    p_show_on_storefront: values.show_on_storefront,
    p_show_in_digital_catalog: values.show_in_digital_catalog,
    p_show_on_internal_transactions: values.show_on_internal_transactions,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("save_item_media") };
    }
    return { error: error.message };
  }

  revalidatePath("/inventory/items");
  return { success: true as const, mediaId: data as string };
}

export async function deleteItemMedia(mediaId: string, storagePath?: string) {
  const { supabase } = await requireTenantId();

  const { error } = await supabase.rpc("delete_item_media", {
    p_media_id: mediaId,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("delete_item_media") };
    }
    return { error: error.message };
  }

  if (storagePath?.trim()) {
    await supabase.storage.from("product-media").remove([storagePath.trim()]);
  }

  revalidatePath("/inventory/items");
  return { success: true as const };
}

export async function saveProductListUserPrefs(raw: unknown) {
  const { supabase } = await requireTenantId();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { coerceProductListPrefs } = await import("@/lib/products/list-prefs");
  const prefs = coerceProductListPrefs(raw);

  const { error } = await supabase.rpc("save_user_product_list_prefs", {
    p_prefs: prefs,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("save_user_product_list_prefs") };
    }
    return { error: error.message };
  }

  return { success: true as const };
}

export type TaxRateOption = {
  id: string;
  tax_component_name: string;
  tax_percentage: string;
  legal_compliance_code: string | null;
};

export async function fetchActiveTaxRateOptions(): Promise<
  { options: TaxRateOption[] } | { error: string }
> {
  const { supabase, tenantId } = await requireTenantId();

  const { data, error } = await supabase
    .from("tax_rate_registry")
    .select("id, tax_component_name, tax_percentage, legal_compliance_code, active_to_date")
    .eq("tenant_id", tenantId)
    .or("active_to_date.is.null,active_to_date.gt." + new Date().toISOString())
    .order("tax_component_name");

  if (error) return { error: error.message };

  const options = (data ?? []).map((row) => ({
    id: row.id as string,
    tax_component_name: row.tax_component_name as string,
    tax_percentage: String(row.tax_percentage),
    legal_compliance_code: (row.legal_compliance_code as string | null) ?? null,
  }));

  return { options };
}

export type ResolveBulkTargetInput = {
  selectAllMatching: boolean;
  selectedIds: string[];
  filteredItemIds?: string[] | null;
  categoryId?: string | null;
};

export async function resolveBulkTargetItemIds(input: ResolveBulkTargetInput) {
  const { supabase, tenantId } = await requireTenantId();

  if (!input.selectAllMatching) {
    const unique = [...new Set(input.selectedIds.filter(Boolean))];
    return { itemIds: unique };
  }

  let candidateIds: string[];

  if (input.filteredItemIds?.length) {
    candidateIds = [...new Set(input.filteredItemIds)];
  } else {
    const { data, error } = await supabase.from("items").select("id").eq("tenant_id", tenantId);

    if (error) return { error: error.message };
    candidateIds = (data ?? []).map((row) => row.id as string);
  }

  if (input.categoryId && input.categoryId !== "all") {
    const { data, error } = await supabase
      .from("items")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("category_id", input.categoryId)
      .in("id", candidateIds);

    if (error) return { error: error.message };
    return { itemIds: (data ?? []).map((row) => row.id as string) };
  }

  return { itemIds: candidateIds };
}

async function resolveBulkItemIds(input: ResolveBulkTargetInput) {
  const resolved = await resolveBulkTargetItemIds(input);
  if ("error" in resolved) return { error: resolved.error };
  if (!resolved.itemIds.length) return { error: "No items selected for bulk action." };
  return { itemIds: resolved.itemIds };
}

export async function bulkAdjustItemPricing(
  target: ResolveBulkTargetInput,
  raw: unknown
) {
  const { bulkPricingAdjustmentSchema } = await import("@/lib/products/bulk-schemas");
  const parsed = bulkPricingAdjustmentSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid pricing adjustment." };
  }

  const idsResult = await resolveBulkItemIds(target);
  if ("error" in idsResult) return { error: idsResult.error };

  const { supabase } = await requireTenantId();
  const value = Number(parsed.data.value);

  const { data, error } = await supabase.rpc("bulk_adjust_item_pricing", {
    p_item_ids: idsResult.itemIds,
    p_mode: parsed.data.mode,
    p_value: value,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("bulk_adjust_item_pricing") };
    }
    return { error: error.message };
  }

  revalidatePath("/inventory/items");
  return { success: true as const, affectedCount: (data as number) ?? idsResult.itemIds.length };
}

export async function bulkSyncItemJurisdiction(
  target: ResolveBulkTargetInput,
  raw: unknown
) {
  const { bulkJurisdictionSchema } = await import("@/lib/products/bulk-schemas");
  const parsed = bulkJurisdictionSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid jurisdiction sync." };
  }

  const idsResult = await resolveBulkItemIds(target);
  if ("error" in idsResult) return { error: idsResult.error };

  const { supabase } = await requireTenantId();

  const { data, error } = await supabase.rpc("bulk_sync_item_jurisdiction", {
    p_item_ids: idsResult.itemIds,
    p_category_id: parsed.data.category_id,
    p_tax_rate_id: parsed.data.tax_rate_id,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("bulk_sync_item_jurisdiction") };
    }
    return { error: error.message };
  }

  revalidatePath("/inventory/items");
  return { success: true as const, affectedCount: (data as number) ?? idsResult.itemIds.length };
}

export async function bulkArchiveItems(target: ResolveBulkTargetInput) {
  const idsResult = await resolveBulkItemIds(target);
  if ("error" in idsResult) return { error: idsResult.error };

  const { supabase } = await requireTenantId();

  const { data, error } = await supabase.rpc("bulk_archive_items", {
    p_item_ids: idsResult.itemIds,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("bulk_archive_items") };
    }
    return { error: error.message };
  }

  revalidatePath("/inventory/items");
  return { success: true as const, affectedCount: (data as number) ?? idsResult.itemIds.length };
}

async function runBulkRpc(
  target: ResolveBulkTargetInput,
  rpc: string,
  params: Record<string, unknown>
) {
  const idsResult = await resolveBulkItemIds(target);
  if ("error" in idsResult) return { error: idsResult.error };

  const { supabase } = await requireTenantId();
  const { data, error } = await supabase.rpc(rpc, {
    p_item_ids: idsResult.itemIds,
    ...params,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError(rpc) };
    }
    return { error: error.message };
  }

  revalidatePath("/inventory/items");
  return { success: true as const, affectedCount: (data as number) ?? idsResult.itemIds.length };
}

export async function bulkReactivateItems(target: ResolveBulkTargetInput) {
  return runBulkRpc(target, "bulk_reactivate_items", {});
}

export async function bulkAdjustPurchasePricing(
  target: ResolveBulkTargetInput,
  raw: unknown
) {
  const { bulkPricingAdjustmentSchema } = await import("@/lib/products/bulk-schemas");
  const parsed = bulkPricingAdjustmentSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid purchase adjustment." };
  }

  return runBulkRpc(target, "bulk_adjust_purchase_pricing", {
    p_mode: parsed.data.mode,
    p_value: Number(parsed.data.value),
  });
}

export async function bulkSetItemCategory(target: ResolveBulkTargetInput, raw: unknown) {
  const { bulkCategorySchema } = await import("@/lib/products/bulk-schemas");
  const parsed = bulkCategorySchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid category selection." };
  }

  return runBulkRpc(target, "bulk_set_item_category", {
    p_category_id: parsed.data.category_id,
  });
}

export async function bulkSetItemClassification(target: ResolveBulkTargetInput, raw: unknown) {
  const { bulkClassificationSchema } = await import("@/lib/products/bulk-schemas");
  const parsed = bulkClassificationSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid classification." };
  }

  return runBulkRpc(target, "bulk_set_item_classification", {
    p_classification: parsed.data.classification,
  });
}

export async function bulkSetItemTaxCategory(target: ResolveBulkTargetInput, raw: unknown) {
  const { bulkTaxCategorySchema } = await import("@/lib/products/bulk-schemas");
  const parsed = bulkTaxCategorySchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid tax category." };
  }

  return runBulkRpc(target, "bulk_set_item_tax_category", {
    p_tax_category: parsed.data.default_tax_category,
  });
}

export async function bulkSetOperationalFlags(target: ResolveBulkTargetInput, raw: unknown) {
  const { bulkOperationalFlagsSchema } = await import("@/lib/products/bulk-schemas");
  const parsed = bulkOperationalFlagsSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid operational flags." };
  }

  const values = parsed.data;
  return runBulkRpc(target, "bulk_set_item_operational_flags", {
    p_is_purchasable: values.apply_purchasable ? values.is_purchasable ?? null : null,
    p_is_salable: values.apply_salable ? values.is_salable ?? null : null,
    p_is_returnable: values.apply_returnable ? values.is_returnable ?? null : null,
  });
}

export async function bulkModifyItemTags(target: ResolveBulkTargetInput, raw: unknown) {
  const { bulkTagsSchema } = await import("@/lib/products/bulk-schemas");
  const parsed = bulkTagsSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid tag selection." };
  }

  return runBulkRpc(target, "bulk_modify_item_tags", {
    p_tag_ids: parsed.data.tag_ids,
    p_mode: parsed.data.mode,
  });
}

export async function bulkSetStorefrontVisibility(target: ResolveBulkTargetInput, raw: unknown) {
  const { bulkStorefrontSchema } = await import("@/lib/products/bulk-schemas");
  const parsed = bulkStorefrontSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid storefront selection." };
  }

  return runBulkRpc(target, "bulk_set_storefront_visibility", {
    p_storefront_id: parsed.data.storefront_id,
    p_is_visible: parsed.data.is_visible,
  });
}
