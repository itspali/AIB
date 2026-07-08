"use server";

import { revalidatePath } from "next/cache";
import {
  allocateNextItemSku,
  normalizeGtinInput,
  parseCatalogItemSettings,
} from "@/lib/products/catalog-item-settings";
import {
  EXACT_DUPLICATE_ITEM_NAME_MESSAGE,
  itemNamesMatchTenantWide,
} from "@/lib/products/item-name-uniqueness";
import { finalizeAttributeTemplateRows } from "@/lib/categories/attribute-key";
import { fetchCategoryRows } from "@/lib/categories/queries";
import type { ItemSource } from "@/lib/products/item-model";
import { generatePdfFromHtml } from "@/lib/email/generate-document-pdf";
import { enrichProductDetailSnapshot } from "@/lib/products/detail-enrichment";
import { renderProductListExportTableHtml, resolveProductListPdfLandscape } from "@/lib/products/list-export";
import {
  buildProductMasterInputFromImportRow,
  type ProductListImportRow,
} from "@/lib/products/list-import";
import {
  buildProductMasterInputFromSkuImportRow,
  buildVariantInputFromSkuImportRow,
  type ProductSkuImportRow,
} from "@/lib/products/list-sku-import";
import { fetchProductCatalogContext } from "@/lib/products/commerce-queries";
import {
  fetchProductListByIds,
  fetchProductListPage,
  PRODUCT_LIST_PAGE_SIZE,
} from "@/lib/products/list-queries";
import { resolveProductMediaSignedUrls } from "@/lib/products/media";
import {
  fetchProductDetail,
  fetchProductPeekSection,
  fetchProductPeekValuations,
  fetchProductVariantReload,
  ITEM_VARIANTS_EMBED,
  type FetchProductDetailOptions,
} from "@/lib/products/queries";
import type { ProductCatalogContext, ProductDetailSnapshot } from "@/lib/products/types";
import { detailToFormValues } from "@/lib/products/types";
import { inferVariantStrategy } from "@/lib/products/variant-strategy";
import type { ProductPeekSection } from "@/lib/products/peek-panels";
import { resolveSessionProductFieldPermissions } from "@/lib/products/field-permissions-server";
import { productMasterSchema } from "@/lib/products/schemas";
import {
  buildAlternateUomsPayload,
  buildCommerceCustomFieldDefaults,
} from "@/lib/products/item-uom-commerce";
import { buildReservedCatalogCustomFieldsPayload } from "@/lib/products/catalog-reserved-fields";
import {
  extractStoredReorderPoint,
  reorderPointChanged,
} from "@/lib/products/buffer-thresholds";
import { buildCustomFieldsPayload } from "@/lib/products/sku-mask";
import type { ProductMasterInput } from "@/lib/products/schemas";
import { itemMediaSchema, itemVariantSchema } from "@/lib/products/variant-schemas";
import type { ItemClassification } from "@/lib/products/classification-labels";
import type {
  CompositionComponentCandidate,
  CompositionLineRow,
  CompositionPriceMode,
} from "@/lib/products/composition";
import {
  allowedComponentItemTypes,
  validateCompositionDraftRows,
} from "@/lib/products/composition";
import { itemLifecycleStatusFromActive, type ItemType } from "@/lib/products/item-model";
import { resolveItemTaxCodePickerOptions } from "@/lib/tax/item-tax-code-picker";
import { postStockAdjustment } from "@/app/inventory/stock/actions";
import {
  buildFifoUnsupportedStockError,
  resolveFifoBlockReason,
  resolveStockPostingValuationEngine,
} from "@/lib/inventory/stock/valuation-engine";
import {
  buildOpeningAdjustmentsByLocation,
  hasPendingOpeningStockEntries,
  openingStockCellKey,
  type OpeningStockDraftCell,
  type OpeningStockOnHandCell,
} from "@/lib/products/opening-stock";
import { fetchItemVariantValuations } from "@/lib/products/opening-stock-queries";
import { formatRpcDeployError, isMissingRpcError } from "@/lib/supabase/rpc-error";
import { requireTenantMutation } from "@/lib/supabase/require-tenant";

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

function slugifyTagName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function ensureProductTag(name: string, tagGroup?: string) {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Tag name is required." };

  const { supabase } = await requireTenantMutation();
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

  revalidatePath("/items");
  return { success: true as const, tagId: data as string };
}

export async function updateProductTag(tagId: string, name: string) {
  const trimmed = name.trim();
  if (!tagId.trim()) return { error: "Tag id is required." };
  if (!trimmed) return { error: "Tag name is required." };

  const slug = slugifyTagName(trimmed);
  if (!slug) return { error: "Tag name must contain letters or numbers." };

  const { supabase, tenantId } = await requireTenantMutation();
  const { data: existing, error: existingError } = await supabase
    .from("tags")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("slug", slug)
    .neq("id", tagId)
    .maybeSingle();

  if (existingError) return { error: existingError.message };
  if (existing) return { error: "Another tag already uses that name." };

  const { error } = await supabase
    .from("tags")
    .update({ name: trimmed, slug })
    .eq("tenant_id", tenantId)
    .eq("id", tagId);

  if (error) return { error: error.message };

  revalidatePath("/items");
  return { success: true as const, tag: { id: tagId, name: trimmed, slug } };
}

export async function deleteProductTag(tagId: string) {
  if (!tagId.trim()) return { error: "Tag id is required." };

  const { supabase, tenantId } = await requireTenantMutation();
  const { error } = await supabase.from("tags").delete().eq("tenant_id", tenantId).eq("id", tagId);

  if (error) return { error: error.message };

  revalidatePath("/items");
  return { success: true as const };
}

export async function saveProductMasterProfile(
  raw: unknown,
  options?: { source?: ItemSource }
) {
  const parsed = productMasterSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid product profile" };
  }

  const values = parsed.data;
  const { supabase, tenantId } = await requireTenantMutation();

  let previousReorderPoint = "";
  if (values.item_id) {
    const { data: existingItem, error: existingItemError } = await supabase
      .from("items")
      .select("custom_fields")
      .eq("tenant_id", tenantId)
      .eq("id", values.item_id)
      .maybeSingle();
    if (existingItemError) return { error: existingItemError.message };
    previousReorderPoint = extractStoredReorderPoint(
      (existingItem?.custom_fields as Record<string, unknown> | null) ?? null
    );
  }

  const { data: tenantRow } = await supabase
    .from("tenants")
    .select("accounting_config")
    .eq("id", tenantId)
    .maybeSingle();
  const catalogItems = parseCatalogItemSettings(tenantRow?.accounting_config);

  if (!catalogItems.allow_duplicate_item_names) {
    try {
      const exactName = await findExactItemNameInTenant(
        supabase,
        tenantId,
        values.name,
        values.item_id
      );
      if (exactName) {
        return { error: EXACT_DUPLICATE_ITEM_NAME_MESSAGE, nameConflict: true };
      }
    } catch (lookupError) {
      const message =
        lookupError instanceof Error ? lookupError.message : "Unable to verify item name.";
      return { error: message };
    }
  }

  const manualSku = values.sku.trim();
  const autoSkuEnabled =
    !values.item_id && !manualSku && catalogItems.sku_auto_generation_enabled;

  let sku = manualSku;
  const gtin = normalizeGtinInput(values.barcode);
  const rpcPayload = {
    p_item_id: values.item_id,
    p_name: values.name,
    p_classification: values.classification,
    p_base_uom: values.base_unit_of_measure,
    p_category_id: values.category_id,
    p_description: values.description || null,
    p_is_purchasable: values.is_purchasable,
    p_is_salable: values.is_salable,
    p_hsn_sac_code: values.hsn_sac_code || null,
    p_has_variants: values.has_variants,
    p_default_tax_category: values.default_tax_category,
    p_is_returnable: values.is_returnable,
    p_barcode: gtin || null,
    p_variant_attributes: buildVariantAttributes(values.variant_attributes),
    p_dead_weight_kg: parseDecimal(values.dead_weight_kg),
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
    p_custom_fields: {
      ...buildCustomFieldsPayload(values.sku_mask, values.custom_fields),
      ...buildCommerceCustomFieldDefaults(values),
      ...buildReservedCatalogCustomFieldsPayload({
        mrp: values.mrp,
        reorder_point: values.reorder_point,
        selling_price: values.selling_price,
        purchase_price: values.purchase_price,
        variant_strategy: values.variant_strategy,
        supplier_id: values.supplier_id,
      }),
    },
    p_alternate_uoms: buildAlternateUomsPayload(values),
    p_tag_ids: values.tag_ids,
    p_storefront_items: buildStorefrontItemsPayload(values),
    p_variant_strategy: values.variant_strategy,
    p_item_type: values.item_type,
    p_track_inventory:
      values.item_type === "PHYSICAL" && !values.is_bundle
        ? values.track_inventory
        : false,
    p_is_active: values.item_id ? values.is_active : true,
    p_status: itemLifecycleStatusFromActive(values.item_id ? values.is_active : true),
    p_needs_review: values.needs_review,
    p_costing_method: values.costing_method,
    p_standard_cost: parseOptionalDecimal(values.standard_cost),
    p_tracking_mode: values.tracking_mode,
    p_is_bundle: values.is_bundle,
    p_price_is_tax_inclusive: false,
    p_expected_updated_at: values.item_id ? values.updated_at : null,
    p_source: values.item_id ? undefined : options?.source ?? "MANUAL",
  };

  const maxSkuAttempts = autoSkuEnabled ? 10 : 1;
  let data: string | null = null;
  let error: { message: string } | null = null;

  for (let attempt = 0; attempt < maxSkuAttempts; attempt++) {
    if (!sku) {
      if (autoSkuEnabled) {
        try {
          sku = await allocateNextItemSku(supabase, tenantId, catalogItems);
        } catch (allocationError) {
          const message =
            allocationError instanceof Error
              ? allocationError.message
              : "Unable to auto-generate product code.";
          return { error: message };
        }
      } else {
        return { error: "Product code is required." };
      }
    }

    const rpcResult = await supabase.rpc("save_product_master_profile", {
      ...rpcPayload,
      p_sku: sku,
    });
    data = rpcResult.data as string | null;
    error = rpcResult.error;

    if (!error) break;

    if (autoSkuEnabled && error.message.toLowerCase().includes("sku already exists")) {
      sku = "";
      continue;
    }
    break;
  }

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("save_product_master_profile") };
    }
    const message = error.message.toLowerCase();
    if (message.includes("modified by another session")) {
      return {
        error:
          "This item was changed by someone else since you opened it. Reload to get the latest version, then reapply your edits.",
        conflict: true as const,
      };
    }
    if (message.includes("sku already exists")) {
      return {
        error: "Master SKU is already assigned to another product in this workspace.",
        skuConflict: true as const,
      };
    }
    if (message.includes("cannot change after transactions exist")) {
      return {
        error:
          "Base unit, classification, and item type are locked once this item has transaction history.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/items");
  revalidatePath("/items/categories");

  const itemId = data as string;

  if (
    values.item_id &&
    values.track_inventory &&
    reorderPointChanged(previousReorderPoint, values.reorder_point)
  ) {
    const propagateResult = await supabase.rpc("propagate_item_reorder_default", {
      p_item_id: itemId,
    });
    if (propagateResult.error && !isMissingRpcError(propagateResult.error)) {
      return { error: propagateResult.error.message };
    }
  }

  // Bind the canonical tax rule via an isolated RPC so we don't have to
  // re-deploy the large save_product_master_profile signature.
  const taxCodeResult = await supabase.rpc("set_item_tax_code", {
    p_item_id: itemId,
    p_tax_code_id: values.tax_code_id,
  });
  if (taxCodeResult.error && !isMissingRpcError(taxCodeResult.error)) {
    return { error: taxCodeResult.error.message };
  }

  // Persist the variant composition (which attributes vary) via an isolated
  // RPC, same rationale as the tax rule binding above.
  const variantAxesResult = await supabase.rpc("set_item_variant_axes", {
    p_item_id: itemId,
    p_variant_axes: values.variant_axes ?? [],
  });
  if (variantAxesResult.error && !isMissingRpcError(variantAxesResult.error)) {
    return { error: variantAxesResult.error.message };
  }

  const extraSkuOptions = finalizeAttributeTemplateRows(values.extra_sku_options ?? []);
  const extraOptionsResult = await supabase.rpc("set_item_extra_sku_options", {
    p_item_id: itemId,
    p_extra_sku_options: extraSkuOptions,
  });
  if (extraOptionsResult.error && !isMissingRpcError(extraOptionsResult.error)) {
    return { error: extraOptionsResult.error.message };
  }

  const detail = await fetchProductDetail(supabase, tenantId, itemId);

  return { success: true as const, itemId, detail };
}

export async function getProductDetail(
  itemId: string,
  variantId?: string | null,
  options?: Pick<FetchProductDetailOptions, "scope">
) {
  const { supabase, tenantId } = await requireTenantMutation();
  const detail = await fetchProductDetail(supabase, tenantId, itemId, {
    variantId,
    scope: options?.scope ?? "full",
  });
  if (!detail) return { error: "Product profile not found." };
  return { detail };
}

export async function getProductVariants(itemId: string) {
  if (!itemId.trim()) return { error: "Product id is required." };
  const { supabase, tenantId } = await requireTenantMutation();
  const bundle = await fetchProductVariantReload(supabase, tenantId, itemId);
  if (!bundle) return { error: "Product variants not found." };
  return { bundle };
}

export async function loadProductDrawer(
  itemId: string,
  options?: {
    variantId?: string | null;
    scope?: "peek" | "full";
    skipCatalogContext?: boolean;
  }
) {
  if (!itemId.trim()) return { error: "Product id is required." };

  const { supabase, tenantId } = await requireTenantMutation();
  const scope = options?.scope ?? "peek";
  const skipCatalogContext = options?.skipCatalogContext ?? false;

  const shouldFetchCatalog = !skipCatalogContext && scope !== "peek";

  const [catalogContext, detail] = await Promise.all([
    shouldFetchCatalog
      ? fetchProductCatalogContext(supabase, tenantId)
      : Promise.resolve(null),
    fetchProductDetail(supabase, tenantId, itemId, {
      variantId: options?.variantId,
      scope,
    }),
  ]);

  if (!detail) return { error: "Product profile not found." };

  const enrichedDetail = catalogContext
    ? enrichProductDetailSnapshot(detail, catalogContext)
    : detail;

  return {
    catalogContext,
    detail: enrichedDetail,
  };
}

export async function loadProductPeekValuations(
  itemId: string,
  variantId?: string | null,
  options?: { skipEligibilityCheck?: boolean }
) {
  if (!itemId.trim()) return { error: "Product id is required." };

  const { supabase, tenantId } = await requireTenantMutation();
  const valuations = await fetchProductPeekValuations(
    supabase,
    tenantId,
    itemId,
    variantId,
    options?.skipEligibilityCheck
  );

  return { valuations };
}

export async function loadProductPeekSection(
  itemId: string,
  section: ProductPeekSection,
  variantId?: string | null
) {
  if (!itemId.trim()) return { error: "Product id is required." };

  const { supabase, tenantId } = await requireTenantMutation();
  const patch = await fetchProductPeekSection(
    supabase,
    tenantId,
    itemId,
    section,
    variantId
  );
  if (!patch) return { error: "Product section not found." };

  // Storefront labels are enriched client-side from SSR/catalogContext cache
  // (see useProductPeekPanel lazy section loading).
  return { section, patch };
}

export async function upgradeProductDetailToFull(
  itemId: string,
  variantId?: string | null
) {
  const { supabase, tenantId } = await requireTenantMutation();
  const detail = await fetchProductDetail(supabase, tenantId, itemId, {
    variantId,
    scope: "full",
  });
  if (!detail) return { error: "Product profile not found." };
  return { detail };
}

export async function hydrateProductDetailMedia(itemId: string) {
  if (!itemId.trim()) return { error: "Product id is required." };
  const { supabase, tenantId } = await requireTenantMutation();
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

  if (error) return { error: error.message };
  if (!data?.length) return { media: [] as ProductDetailSnapshot["media"] };

  const signedUrls = await resolveProductMediaSignedUrls(
    supabase,
    data.map((row) => row.storage_url as string)
  );

  return {
    media: data.map((row) => ({
      id: row.id as string,
      item_id: row.item_id as string,
      variant_id: (row.variant_id as string | null) ?? null,
      storage_url: row.storage_url as string,
      preview_url: signedUrls.get(row.storage_url as string) ?? null,
      sort_order: row.sort_order as number,
      is_primary: row.is_primary as boolean,
      show_on_storefront: row.show_on_storefront as boolean,
      show_in_digital_catalog: row.show_in_digital_catalog as boolean,
      show_on_internal_transactions: row.show_on_internal_transactions as boolean,
      created_at: row.created_at as string,
    })),
  };
}

type ItemEditability = {
  has_history: boolean;
  can_permanently_delete: boolean;
  locked_fields: string[];
};

export async function getItemEditability(itemId: string) {
  const { supabase } = await requireTenantMutation();
  const { data, error } = await supabase.rpc("item_editability", { p_item_id: itemId });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("item_editability") };
    }
    return { error: error.message };
  }

  const raw = (data ?? {}) as Partial<ItemEditability>;
  const hasHistory = Boolean(raw.has_history);
  return {
    editability: {
      has_history: hasHistory,
      can_permanently_delete:
        typeof raw.can_permanently_delete === "boolean"
          ? raw.can_permanently_delete
          : !hasHistory,
      locked_fields: Array.isArray(raw.locked_fields) ? raw.locked_fields : [],
    } satisfies ItemEditability,
  };
}

export async function deleteItem(itemId: string) {
  const { supabase } = await requireTenantMutation();
  const { error } = await supabase.rpc("delete_item", { p_item_id: itemId });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("delete_item") };
    }
    const message = error.message ?? "";
    if (message.includes("ITEM_IN_USE")) {
      return {
        error:
          "This item is used in a transaction and cannot be permanently deleted. Archive it instead.",
      };
    }
    return { error: message || "Unable to delete item." };
  }

  revalidatePath("/items");
  return { success: true as const };
}

export type SimilarItem = {
  id: string;
  name: string;
  code: string | null;
  category_id: string | null;
  similarity: number;
};

export async function findSimilarItems(
  name: string,
  options?: { categoryId?: string | null; limit?: number }
) {
  const trimmed = name.trim();
  if (trimmed.length < 2) return { matches: [] as SimilarItem[] };

  const { supabase } = await requireTenantMutation();
  const { data, error } = await supabase.rpc("find_similar_items", {
    p_name: trimmed,
    p_category_id: options?.categoryId ?? null,
    p_limit: options?.limit ?? 5,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("find_similar_items") };
    }
    return { error: error.message };
  }

  return { matches: (data ?? []) as SimilarItem[] };
}

export type ExactItemNameMatch = {
  id: string;
  name: string;
};

async function findExactItemNameInTenant(
  supabase: Awaited<ReturnType<typeof requireTenantMutation>>["supabase"],
  tenantId: string,
  name: string,
  excludeItemId?: string | null
): Promise<ExactItemNameMatch | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  let query = supabase.from("items").select("id, name").eq("tenant_id", tenantId);

  if (excludeItemId) {
    query = query.neq("id", excludeItemId);
  }

  const { data, error } = await query.ilike("name", trimmed);

  if (error) {
    throw new Error(error.message);
  }

  const match = (data ?? []).find((row) => itemNamesMatchTenantWide(row.name, trimmed));
  return match ? { id: match.id, name: match.name } : null;
}

export async function findExactItemByName(name: string, excludeItemId?: string | null) {
  const trimmed = name.trim();
  if (!trimmed) return { match: null as ExactItemNameMatch | null };

  try {
    const { supabase, tenantId } = await requireTenantMutation();
    const match = await findExactItemNameInTenant(supabase, tenantId, trimmed, excludeItemId);
    return { match };
  } catch (lookupError) {
    const message =
      lookupError instanceof Error ? lookupError.message : "Unable to check item name.";
    return { error: message };
  }
}

type QuickCreateItemInput = {
  name: string;
  sku?: string;
  base_unit_of_measure?: string;
  selling_price?: string | number | null;
  category_id?: string | null;
  doc_type?: "sales" | "purchase";
};

export type QuickCreatedItem = {
  itemId: string;
  variantId: string;
  name: string;
  sku: string;
};

function generateQuickCreateSku(): string {
  return `QC-${Date.now().toString(36).toUpperCase()}`;
}

/**
 * Lean item creation for transaction line "type-to-create" flows.
 * Always SINGLE_SKU + PHYSICAL so it yields one sellable variant_id,
 * flagged needs_review so the catalog team can complete it later.
 */
export async function quickCreateItem(input: QuickCreateItemInput) {
  const { supabase, tenantId } = await requireTenantMutation();

  const name = input.name.trim();
  if (!name) return { error: "Item name is required" };

  const sku = input.sku?.trim() || generateQuickCreateSku();
  const sellingPrice =
    input.selling_price == null || input.selling_price === ""
      ? null
      : Number(input.selling_price);
  if (sellingPrice != null && !Number.isFinite(sellingPrice)) {
    return { error: "Selling price must be a number" };
  }

  const { data, error } = await supabase.rpc("save_product_master_profile", {
    p_name: name,
    p_sku: sku,
    p_classification: "FINISHED_GOOD",
    p_base_uom: input.base_unit_of_measure?.trim() || "PCS",
    p_category_id: input.category_id ?? null,
    p_is_purchasable: input.doc_type !== "sales",
    p_is_salable: input.doc_type !== "purchase",
    p_selling_price: sellingPrice,
    p_item_type: "PHYSICAL",
    p_variant_strategy: "SINGLE_SKU",
    p_source: "QUICK_CREATE",
    p_needs_review: true,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("save_product_master_profile") };
    }
    if (error.message.toLowerCase().includes("sku already exists")) {
      return { error: "That product code is already in use." };
    }
    return { error: error.message };
  }

  const itemId = data as string;

  const { data: variantRow, error: variantError } = await supabase
    .from("item_variants")
    .select("id, sku")
    .eq("tenant_id", tenantId)
    .eq("item_id", itemId)
    .eq("is_master", true)
    .maybeSingle();

  if (variantError || !variantRow) {
    return { error: variantError?.message ?? "Created item is missing its sellable variant." };
  }

  revalidatePath("/items");

  return {
    success: true as const,
    item: {
      itemId,
      variantId: variantRow.id as string,
      name,
      sku: (variantRow.sku as string) ?? sku,
    } satisfies QuickCreatedItem,
  };
}

export async function getProductCatalogContext() {
  const { supabase, tenantId } = await requireTenantMutation();
  const catalogContext = await fetchProductCatalogContext(supabase, tenantId);
  return { catalogContext };
}

export async function fetchMoreProductListRows(
  offset: number,
  options?: { expandVariants?: boolean; includeImages?: boolean }
) {
  const { supabase, tenantId } = await requireTenantMutation();

  const [permissions, page] = await Promise.all([
    resolveSessionProductFieldPermissions(supabase, tenantId),
    fetchProductListPage(supabase, tenantId, undefined, {
      offset,
      limit: PRODUCT_LIST_PAGE_SIZE,
      includeImages: options?.includeImages ?? false,
      expandVariants: options?.expandVariants,
    }),
  ]);

  if (!permissions) return page;

  const { redactProductListRows } = await import("@/lib/products/field-permissions");
  return {
    ...page,
    rows: redactProductListRows(page.rows, permissions.allowedFields),
  };
}

export async function fetchProductListByFilterIds(
  itemIds: string[],
  options?: { expandVariants?: boolean; includeImages?: boolean }
) {
  const { supabase, tenantId } = await requireTenantMutation();

  const [permissions, page] = await Promise.all([
    resolveSessionProductFieldPermissions(supabase, tenantId),
    fetchProductListByIds(supabase, tenantId, itemIds, undefined, {
      includeImages: options?.includeImages ?? false,
      expandVariants: options?.expandVariants,
    }),
  ]);

  if (!permissions) return page;

  const { redactProductListRows } = await import("@/lib/products/field-permissions");
  return {
    ...page,
    rows: redactProductListRows(page.rows, permissions.allowedFields),
  };
}

export async function exportProductListPdf(input: {
  headers: string[];
  rows: string[][];
  title?: string;
}) {
  if (!input.headers.length || !input.rows.length) {
    return { error: "Nothing to export." };
  }

  await requireTenantMutation();

  const landscape = resolveProductListPdfLandscape(input.headers.length);
  const html = renderProductListExportTableHtml(
    { headers: input.headers, rows: input.rows, columnIds: [] },
    input.title ?? "Items export",
    { landscape }
  );
  const pdfResult = await generatePdfFromHtml(html, { landscape });
  if (!pdfResult.ok) {
    return { error: pdfResult.error };
  }

  return {
    filename: "items-export.pdf",
    pdfBase64: pdfResult.buffer.toString("base64"),
    landscape,
  };
}

export async function importProductListRows(
  rows: ProductListImportRow[]
): Promise<
  | { imported: number; failed: number }
  | { error: string }
> {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: "No rows to import." };
  }

  const { supabase, tenantId } = await requireTenantMutation();
  const categories = await fetchCategoryRows(supabase, tenantId);

  let imported = 0;
  let failed = 0;

  for (const row of rows) {
    const payload = buildProductMasterInputFromImportRow(row, categories);
    if (!payload) continue;

    const result = await saveProductMasterProfile(payload);
    if ("error" in result) {
      failed += 1;
      continue;
    }
    imported += 1;
  }

  revalidatePath("/items");
  return { imported, failed };
}

export async function importProductSkuRows(
  rows: ProductSkuImportRow[]
): Promise<
  | { imported: number; updated: number; failed: number; errors: string[] }
  | { error: string }
> {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: "No rows to import." };
  }

  const { supabase, tenantId } = await requireTenantMutation();
  const categories = await fetchCategoryRows(supabase, tenantId);

  let imported = 0;
  let updated = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const sku = row.sku.trim();
    if (!sku) {
      failed += 1;
      errors.push(`Row ${row.rowNumber}: SKU is required.`);
      continue;
    }

    const { data: existingVariant, error: lookupError } = await supabase
      .from("item_variants")
      .select("id, item_id, sku")
      .eq("tenant_id", tenantId)
      .eq("sku", sku)
      .maybeSingle();

    if (lookupError) {
      failed += 1;
      errors.push(`Row ${row.rowNumber}: ${lookupError.message}`);
      continue;
    }

    if (existingVariant?.id && existingVariant.item_id) {
      const variantPayload = buildVariantInputFromSkuImportRow(
        row,
        existingVariant.item_id,
        existingVariant.id
      );
      const variantResult = await saveItemVariant(variantPayload);
      if ("error" in variantResult) {
        failed += 1;
        errors.push(`Row ${row.rowNumber}: ${variantResult.error}`);
        continue;
      }
      updated += 1;
      continue;
    }

    const productCode = row.productCode.trim() || sku;
    let targetItemId: string | null = null;

    if (productCode) {
      const { data: existingItem } = await supabase
        .from("items")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("code", productCode)
        .maybeSingle();
      targetItemId = existingItem?.id ?? null;
    }

    if (targetItemId) {
      const variantPayload = buildVariantInputFromSkuImportRow(row, targetItemId);
      const variantResult = await saveItemVariant(variantPayload);
      if ("error" in variantResult) {
        failed += 1;
        errors.push(`Row ${row.rowNumber}: ${variantResult.error}`);
        continue;
      }
      imported += 1;
      continue;
    }

    const masterPayload = buildProductMasterInputFromSkuImportRow(row, categories, {
      productCode,
    });
    if (!masterPayload?.name.trim()) {
      failed += 1;
      errors.push(`Row ${row.rowNumber}: Name is required for new products.`);
      continue;
    }

    const createResult = await saveProductMasterProfile(masterPayload, { source: "IMPORT" });
    if ("error" in createResult) {
      failed += 1;
      errors.push(`Row ${row.rowNumber}: ${createResult.error}`);
      continue;
    }

    if (sku !== productCode) {
      const variantPayload = buildVariantInputFromSkuImportRow(row, createResult.itemId);
      const variantResult = await saveItemVariant(variantPayload);
      if ("error" in variantResult) {
        failed += 1;
        errors.push(`Row ${row.rowNumber}: ${variantResult.error}`);
        continue;
      }
    }

    imported += 1;
  }

  revalidatePath("/items");
  return { imported, updated, failed, errors };
}

export async function hydrateProductListImageUrls(itemIds: string[]) {
  const uniqueIds = [...new Set(itemIds.filter(Boolean))];
  if (!uniqueIds.length) return { imageUrls: {} as Record<string, string | null> };

  const { supabase, tenantId } = await requireTenantMutation();
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

  const { supabase, tenantId } = await requireTenantMutation();
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
  const { supabase } = await requireTenantMutation();
  const variantGtin = normalizeGtinInput(values.barcode);

  const { data, error } = await supabase.rpc("save_item_variant", {
    p_item_id: values.item_id,
    p_sku: values.sku,
    p_variant_id: values.variant_id,
    p_barcode: variantGtin || null,
    p_variant_attributes: buildVariantAttributes(values.variant_attributes),
    p_dead_weight_kg: parseDecimal(values.dead_weight_kg),
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

  revalidatePath("/items");
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

  const { supabase } = await requireTenantMutation();

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

  revalidatePath("/items");
  return { success: true as const, createdCount: (data as number) ?? payload.length };
}

function variantAxisKeysEqual(stored: readonly string[], next: readonly string[]): boolean {
  if (stored.length !== next.length) return false;
  return stored.every((key, index) => key === next[index]);
}

function countSellableVariants(detail: ProductDetailSnapshot): number {
  return detail.variants.filter((row) => !row.is_master && row.is_sellable !== false).length;
}

/** Persist variant axes + inferred strategy after matrix create/update (list + detail rely on both). */
export async function syncItemVariantCatalogAfterMatrix(
  itemId: string,
  axisKeys: string[]
) {
  if (!itemId.trim()) return { error: "Product id is required." };

  const axesResult = await saveItemVariantAxes(itemId, axisKeys);
  if ("error" in axesResult) return axesResult;

  const detailResult = await getProductDetail(itemId);
  if ("error" in detailResult || !detailResult.detail) {
    return {
      error: detailResult.error ?? "Unable to load product after saving variants.",
    };
  }

  const detail = detailResult.detail;
  const inferredStrategy = inferVariantStrategy({
    sellableVariantCount: countSellableVariants(detail),
    totalVariantRows: detail.variants.length,
    persistedStrategy: detail.variant_strategy,
    selectedAxisCount: axisKeys.length,
  });

  const needsStrategySync = inferredStrategy !== detail.variant_strategy;
  const needsAxesSync = !variantAxisKeysEqual(detail.variant_axes, axisKeys);
  if (!needsStrategySync && !needsAxesSync) {
    return { success: true as const, detail };
  }

  const values = detailToFormValues(detail);
  values.variant_strategy = inferredStrategy;
  values.variant_axes = axisKeys;

  const saveResult = await saveProductMasterProfile(values);
  if ("error" in saveResult) return saveResult;

  if (saveResult.detail) {
    return { success: true as const, detail: saveResult.detail };
  }

  const refreshed = await getProductDetail(itemId);
  if ("error" in refreshed || !refreshed.detail) {
    return {
      error: refreshed.error ?? "Variants were saved but the product profile could not be refreshed.",
    };
  }

  return { success: true as const, detail: refreshed.detail };
}

/** Apply per-variant supplier cost quotes after matrix bulk create (merges into existing catalog). */
export async function syncMatrixVariantSupplierPrices(
  itemId: string,
  supplierId: string,
  rows: Array<{ sku: string; costPrice: string }>
) {
  if (!itemId.trim()) return { error: "Product id is required." };
  if (!supplierId.trim()) return { error: "Supplier is required." };

  const priced = rows
    .map((row) => ({
      sku: row.sku.trim(),
      costPrice: row.costPrice.trim(),
    }))
    .filter((row) => row.sku && row.costPrice && Number(row.costPrice) >= 0);
  if (!priced.length) return { success: true as const };

  const { supabase, tenantId } = await requireTenantMutation();
  const skus = priced.map((row) => row.sku);

  const { data: variants, error: variantError } = await supabase
    .from("item_variants")
    .select("id, sku")
    .eq("tenant_id", tenantId)
    .eq("item_id", itemId)
    .in("sku", skus);

  if (variantError) return { error: variantError.message };

  const skuToVariantId = new Map(
    (variants ?? []).map((row) => [String(row.sku), String(row.id)])
  );

  const catalogResult = await getSupplierCatalog(itemId);
  if ("error" in catalogResult) return catalogResult;

  const costBySku = new Map(priced.map((row) => [row.sku, Number(row.costPrice)]));
  const existing = catalogResult.data.entries.map((entry) => ({
    variant_id: entry.variant_id,
    supplier_id: entry.supplier_id,
    supplier_price: entry.supplier_price,
    supplier_part_number: entry.supplier_part_number,
    minimum_order_quantity: entry.minimum_order_quantity,
    lead_time_days: entry.lead_time_days,
    is_preferred: entry.is_preferred,
  }));

  const seen = new Set(
    existing.map((row) => `${row.variant_id ?? "*"}|${row.supplier_id}`)
  );

  for (const [sku, cost] of costBySku) {
    const variantId = skuToVariantId.get(sku);
    if (!variantId) continue;
    const combo = `${variantId}|${supplierId}`;
    if (seen.has(combo)) {
      const index = existing.findIndex(
        (row) => row.variant_id === variantId && row.supplier_id === supplierId
      );
      if (index >= 0) existing[index] = { ...existing[index], supplier_price: cost };
      continue;
    }
    seen.add(combo);
    existing.push({
      variant_id: variantId,
      supplier_id: supplierId,
      supplier_price: cost,
      supplier_part_number: null,
      minimum_order_quantity: 1,
      lead_time_days: null,
      is_preferred: false,
    });
  }

  return saveSupplierCatalog(itemId, existing);
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
    is_commercial_storefront: boolean;
  }>;
  cells: VariantAssortmentCell[];
};

export async function getVariantAssortment(
  itemId: string
): Promise<{ data: VariantAssortmentData } | { error: string }> {
  if (!itemId.trim()) return { error: "Product id is required." };

  const { supabase, tenantId } = await requireTenantMutation();
  const [{ data: locations, error: locError }, { data: rows, error: rowError }] = await Promise.all([
    supabase
      .from("tenant_locations")
      .select("id, name, presence_type, is_stock_holding, is_commercial_storefront")
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

  const { supabase } = await requireTenantMutation();
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

  revalidatePath("/items");
  return { success: true as const };
}

export type BufferThresholdCell = {
  variant_id: string;
  location_id: string;
  reorder_point_qty: string;
};

export type BufferThresholdData = {
  locations: VariantAssortmentData["locations"];
  cells: BufferThresholdCell[];
};

export async function getItemBufferThresholds(
  itemId: string
): Promise<{ data: BufferThresholdData } | { error: string }> {
  if (!itemId.trim()) return { error: "Product id is required." };

  const { supabase, tenantId } = await requireTenantMutation();
  const [{ data: locations, error: locError }, { data: rows, error: rowError }] = await Promise.all([
    supabase
      .from("tenant_locations")
      .select("id, name, presence_type, is_stock_holding, is_commercial_storefront")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("inventory_buffer_thresholds")
      .select("variant_id, location_id, reorder_point_qty")
      .eq("tenant_id", tenantId)
      .eq("item_id", itemId),
  ]);

  if (locError) return { error: locError.message };
  if (rowError) return { error: rowError.message };

  return {
    data: {
      locations: (locations ?? []) as BufferThresholdData["locations"],
      cells: ((rows ?? []) as Array<{
        variant_id: string;
        location_id: string;
        reorder_point_qty: number | string;
      }>).map((row) => ({
        variant_id: row.variant_id,
        location_id: row.location_id,
        reorder_point_qty: String(row.reorder_point_qty),
      })),
    },
  };
}

export async function getItemOpeningStockOnHand(
  itemId: string
): Promise<{ cells: OpeningStockOnHandCell[] } | { error: string }> {
  if (!itemId.trim()) return { error: "Product id is required." };
  const { supabase, tenantId } = await requireTenantMutation();
  try {
    const cells = await fetchItemVariantValuations(supabase, tenantId, itemId);
    return { cells };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to load on-hand balances." };
  }
}

export async function postItemOpeningStock(itemId: string, entries: OpeningStockDraftCell[]) {
  if (!itemId.trim()) return { error: "Product id is required." };
  if (!hasPendingOpeningStockEntries(entries)) {
    return { success: true as const, postedLocationCount: 0 };
  }

  const assortmentResult = await getVariantAssortment(itemId);
  if ("error" in assortmentResult) {
    return { error: assortmentResult.error };
  }

  const stockedKeys = new Set(
    assortmentResult.data.cells
      .filter((cell) => cell.is_stocked)
      .map((cell) => openingStockCellKey(cell.variant_id, cell.location_id))
  );

  const eligibleEntries = entries.filter((entry) =>
    stockedKeys.has(openingStockCellKey(entry.variant_id, entry.location_id))
  );

  const { supabase, tenantId } = await requireTenantMutation();
  const { data: variantRows, error: variantError } = await supabase
    .from("item_variants")
    .select("id, is_sellable")
    .eq("tenant_id", tenantId)
    .eq("item_id", itemId);

  if (variantError) return { error: variantError.message };

  const sellableVariantIds = new Set(
    (variantRows ?? [])
      .filter((row) => row.is_sellable === true)
      .map((row) => row.id as string)
  );

  const sellableEntries = eligibleEntries.filter((entry) =>
    sellableVariantIds.has(entry.variant_id)
  );

  const grouped = buildOpeningAdjustmentsByLocation(sellableEntries);
  if (grouped.size === 0) {
    return { success: true as const, postedLocationCount: 0 };
  }

  const locationIds = [...grouped.keys()];
  const [{ data: itemRow }, { data: tenantRow }, { data: locationRows }] = await Promise.all([
    supabase
      .from("items")
      .select("costing_method")
      .eq("tenant_id", tenantId)
      .eq("id", itemId)
      .maybeSingle(),
    supabase.from("tenants").select("accounting_config").eq("id", tenantId).maybeSingle(),
    supabase
      .from("tenant_locations")
      .select("id, name, code, valuation_calculation_rule")
      .eq("tenant_id", tenantId)
      .in("id", locationIds),
  ]);

  const itemCostingMethod = (itemRow?.costing_method as string | null) ?? null;
  const tenantValuationMethod =
    typeof tenantRow?.accounting_config === "object" &&
    tenantRow.accounting_config !== null &&
    "inventory_valuation_method" in tenantRow.accounting_config
      ? String(
          (tenantRow.accounting_config as Record<string, unknown>).inventory_valuation_method ?? ""
        )
      : null;

  const locationById = new Map(
    (locationRows ?? []).map((row) => [
      row.id as string,
      {
        name: row.name as string,
        code: (row.code as string) ?? "",
        valuation_calculation_rule: row.valuation_calculation_rule as string | null,
      },
    ])
  );

  const failures: Array<{ message: string; errorAction?: { href: string; label: string } }> =
    [];
  let postedLocationCount = 0;

  for (const [locationId, lines] of grouped) {
    const location = locationById.get(locationId);

    const valuationEngine = resolveStockPostingValuationEngine({
      itemCostingMethod,
      locationValuationRule: location?.valuation_calculation_rule ?? null,
      tenantValuationMethod,
    });

    if (valuationEngine === "FIFO") {
      const fifoError = buildFifoUnsupportedStockError(
        location?.name,
        location?.code,
        resolveFifoBlockReason({
          itemCostingMethod,
          locationValuationRule: location?.valuation_calculation_rule ?? null,
        })
      );
      failures.push({
        message: fifoError.message,
        errorAction: fifoError.action,
      });
      continue;
    }

    const result = await postStockAdjustment({
      location_id: locationId,
      kind: "OPENING",
      reason: "Product setup",
      notes: `Opening stock for item ${itemId}`,
      lines: lines.map((line) => ({
        variant_id: line.variant_id,
        quantity_delta: String(line.quantity_delta),
        unit_cost: String(line.unit_cost),
      })),
    });

    if ("error" in result) {
      failures.push({
        message: result.error ?? "Unable to post opening stock.",
        errorAction: result.errorAction,
      });
      continue;
    }

    postedLocationCount += 1;
  }

  if (failures.length > 0) {
    const primary = failures[0]!;
    const partialPrefix =
      postedLocationCount > 0
        ? `Opening stock saved for ${postedLocationCount} location(s), but not all locations could be updated. `
        : "";
    const body =
      failures.length === 1
        ? primary.message
        : failures.map((entry) => entry.message).join(" ");
    return {
      error: `${partialPrefix}${body}`,
      errorAction: failures.find((entry) => entry.errorAction)?.errorAction ?? primary.errorAction,
    };
  }

  revalidatePath("/items");
  revalidatePath("/inventory/stock");
  revalidatePath("/inventory");
  return { success: true as const, postedLocationCount };
}

export async function saveItemBufferThresholds(itemId: string, rows: BufferThresholdCell[]) {
  if (!itemId.trim()) return { error: "Product id is required." };

  const { supabase } = await requireTenantMutation();
  const payload = rows.map((row) => ({
    variant_id: row.variant_id,
    location_id: row.location_id,
    reorder_point_qty:
      row.reorder_point_qty.trim() === "" ? null : Number(row.reorder_point_qty),
  }));

  const { error } = await supabase.rpc("save_item_buffer_thresholds", {
    p_item_id: itemId,
    p_rows: payload,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("save_item_buffer_thresholds") };
    }
    return { error: error.message };
  }

  revalidatePath("/items");
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

  const { supabase, tenantId } = await requireTenantMutation();
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

  const { supabase } = await requireTenantMutation();
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

  revalidatePath("/items");
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

export type SupplierCatalogEntryRow = {
  variant_id: string | null;
  supplier_id: string;
  supplier_price: number;
  supplier_part_number: string | null;
  minimum_order_quantity: number;
  lead_time_days: number | null;
  is_preferred: boolean;
  supplier_name: string | null;
};

export type SupplierCatalogData = {
  entries: SupplierCatalogEntryRow[];
};

export type ItemDrawerExtensionData = {
  assortment: VariantAssortmentData;
  bufferThresholds: BufferThresholdData;
  channels: VariantChannelData;
  priceBooks: PriceBookEntryData;
  supplierCatalog: SupplierCatalogData;
};

/** Single round-trip for drawer editor extension panels (assortment, channels, price books). */
export async function getItemDrawerExtensionData(
  itemId: string,
  catalogContext?: ProductCatalogContext | null
): Promise<{ data: ItemDrawerExtensionData } | { error: string }> {
  if (!itemId.trim()) return { error: "Product id is required." };

  const { supabase, tenantId } = await requireTenantMutation();
  const useCatalogReference = Boolean(catalogContext);

  const itemScopedQueries = Promise.all([
    supabase
      .from("tenant_locations")
      .select("id, name, presence_type, is_stock_holding, is_commercial_storefront")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("item_variant_locations")
      .select("variant_id, location_id, is_stocked, is_sellable, is_orderable")
      .eq("tenant_id", tenantId)
      .eq("item_id", itemId),
    supabase
      .from("inventory_buffer_thresholds")
      .select("variant_id, location_id, reorder_point_qty")
      .eq("tenant_id", tenantId)
      .eq("item_id", itemId),
    supabase
      .from("storefront_variant_items")
      .select("storefront_id, variant_id, is_visible")
      .eq("tenant_id", tenantId)
      .eq("item_id", itemId),
    supabase
      .from("price_book_entries")
      .select("price_book_id, variant_id, uom_code, min_quantity, price")
      .eq("tenant_id", tenantId)
      .eq("item_id", itemId)
      .order("min_quantity"),
    supabase
      .from("supplier_items")
      .select(
        `
        variant_id,
        supplier_id,
        supplier_price,
        supplier_part_number,
        minimum_order_quantity,
        lead_time_days,
        is_preferred,
        entities!supplier_items_supplier_id_fkey ( name )
      `
      )
      .eq("tenant_id", tenantId)
      .eq("item_id", itemId)
      .order("is_preferred", { ascending: false }),
  ]);

  const referenceQueries = useCatalogReference
    ? Promise.resolve({
        channels: catalogContext!.storefronts.map((row) => ({
          id: row.id,
          name: row.name,
          channel_type: row.channel_type,
        })),
        books: catalogContext!.price_books.map((row) => ({
          id: row.id,
          name: row.name,
          currency_code: row.currency_code,
        })),
        channelError: null as null,
        bookError: null as null,
      })
    : Promise.all([
        supabase
          .from("storefront_channels")
          .select("id, name, channel_type")
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("price_books")
          .select("id, name, currency_code")
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .order("name"),
      ]).then(([channelsResult, booksResult]) => ({
        channels: channelsResult.data ?? [],
        books: booksResult.data ?? [],
        channelError: channelsResult.error,
        bookError: booksResult.error,
      }));

  const [
    [
      { data: locations, error: locError },
      { data: assortmentRows, error: assortmentError },
      { data: bufferRows, error: bufferError },
      { data: channelRows, error: channelRowError },
      { data: entries, error: entryError },
      { data: supplierRows, error: supplierError },
    ],
    referenceData,
  ] = await Promise.all([itemScopedQueries, referenceQueries]);

  const firstError =
    locError ??
    assortmentError ??
    bufferError ??
    referenceData.channelError ??
    channelRowError ??
    referenceData.bookError ??
    entryError ??
    supplierError;
  if (firstError) return { error: firstError.message };

  return {
    data: {
      assortment: {
        locations: (locations ?? []) as VariantAssortmentData["locations"],
        cells: (assortmentRows ?? []) as VariantAssortmentCell[],
      },
      bufferThresholds: {
        locations: (locations ?? []) as BufferThresholdData["locations"],
        cells: ((bufferRows ?? []) as Array<{
          variant_id: string;
          location_id: string;
          reorder_point_qty: number | string;
        }>).map((row) => ({
          variant_id: row.variant_id,
          location_id: row.location_id,
          reorder_point_qty: String(row.reorder_point_qty),
        })),
      },
      channels: {
        channels: referenceData.channels as VariantChannelData["channels"],
        cells: (channelRows ?? []) as VariantChannelCell[],
      },
      priceBooks: {
        books: referenceData.books as PriceBookEntryData["books"],
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
      supplierCatalog: {
        entries: mapSupplierCatalogRows(supplierRows),
      },
    },
  };
}

function mapSupplierCatalogRows(
  rows: Array<{
    variant_id: string | null;
    supplier_id: string;
    supplier_price: number | string;
    supplier_part_number: string | null;
    minimum_order_quantity: number | string;
    lead_time_days: number | null;
    is_preferred: boolean;
    entities: { name: string } | { name: string }[] | null;
  }> | null
): SupplierCatalogEntryRow[] {
  return (rows ?? []).map((row) => {
    const entity = Array.isArray(row.entities) ? row.entities[0] : row.entities;
    return {
      variant_id: row.variant_id,
      supplier_id: row.supplier_id,
      supplier_price: Number(row.supplier_price),
      supplier_part_number: row.supplier_part_number,
      minimum_order_quantity: Number(row.minimum_order_quantity),
      lead_time_days: row.lead_time_days,
      is_preferred: row.is_preferred,
      supplier_name: entity?.name ?? null,
    };
  });
}

export async function getSupplierCatalog(
  itemId: string
): Promise<{ data: SupplierCatalogData } | { error: string }> {
  if (!itemId.trim()) return { error: "Product id is required." };

  const { supabase, tenantId } = await requireTenantMutation();
  const { data, error } = await supabase
    .from("supplier_items")
    .select(
      `
      variant_id,
      supplier_id,
      supplier_price,
      supplier_part_number,
      minimum_order_quantity,
      lead_time_days,
      is_preferred,
      entities!supplier_items_supplier_id_fkey ( name )
    `
    )
    .eq("tenant_id", tenantId)
    .eq("item_id", itemId)
    .order("is_preferred", { ascending: false });

  if (error) return { error: error.message };
  return { data: { entries: mapSupplierCatalogRows(data) } };
}

export async function saveSupplierCatalog(
  itemId: string,
  rows: Array<{
    variant_id: string | null;
    supplier_id: string;
    supplier_price: number;
    supplier_part_number?: string | null;
    minimum_order_quantity?: number;
    lead_time_days?: number | null;
    is_preferred?: boolean;
  }>
) {
  if (!itemId.trim()) return { error: "Product id is required." };

  const { supabase } = await requireTenantMutation();
  const { error } = await supabase.rpc("save_supplier_catalog_entries", {
    p_item_id: itemId,
    p_rows: rows.map((row) => ({
      variant_id: row.variant_id,
      supplier_id: row.supplier_id,
      supplier_price: row.supplier_price,
      supplier_part_number: row.supplier_part_number ?? null,
      minimum_order_quantity: row.minimum_order_quantity ?? 1,
      lead_time_days: row.lead_time_days ?? null,
      is_preferred: row.is_preferred ?? false,
    })),
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("save_supplier_catalog_entries") };
    }
    return { error: error.message };
  }

  revalidatePath("/items");
  return { success: true as const };
}

export type ItemCompositionData = {
  lines: CompositionLineRow[];
};

type CompositionLineDbRow = {
  id: string;
  parent_variant_id: string | null;
  component_item_id: string;
  component_variant_id: string | null;
  quantity: number | string;
  is_mandatory: boolean;
  is_optional_addon: boolean;
  default_selected: boolean;
  unit_price: number | string;
  price_mode: string;
  sort_order: number;
  component_item:
    | { name: string; item_type: ItemType }
    | { name: string; item_type: ItemType }[]
    | null;
  component_variant: { sku: string } | { sku: string }[] | null;
};

function resolveCompositionEmbed<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapCompositionLineRows(data: CompositionLineDbRow[] | null): CompositionLineRow[] {
  return (data ?? []).map((row) => {
    const componentItem = resolveCompositionEmbed(row.component_item);
    const componentVariant = resolveCompositionEmbed(row.component_variant);

    return {
      id: row.id,
      parent_variant_id: row.parent_variant_id,
      component_item_id: row.component_item_id,
      component_variant_id: row.component_variant_id,
      quantity: Number(row.quantity),
      is_mandatory: row.is_mandatory,
      is_optional_addon: row.is_optional_addon,
      default_selected: row.default_selected,
      unit_price: Number(row.unit_price),
      price_mode: (row.price_mode === "COMPLIMENTARY" ? "COMPLIMENTARY" : "FIXED") as CompositionPriceMode,
      sort_order: row.sort_order,
      component_name: componentItem?.name ?? "Unknown item",
      component_item_type: componentItem?.item_type ?? "PHYSICAL",
      component_sku: componentVariant?.sku ?? null,
    };
  });
}

export async function listCompositionComponentCandidates(
  parentItemId: string,
  parentItemType: ItemType,
  classification: ItemClassification
): Promise<{ data: CompositionComponentCandidate[] } | { error: string }> {
  if (!parentItemId.trim()) return { error: "Product id is required." };

  const allowedTypes = allowedComponentItemTypes(parentItemType, classification);
  if (allowedTypes.length === 0) {
    return { data: [] };
  }

  const { supabase, tenantId } = await requireTenantMutation();
  const { data, error } = await supabase
    .from("items")
    .select(
      `
      id,
      name,
      item_type,
      classification,
      ${ITEM_VARIANTS_EMBED} (
        id,
        sku,
        price,
        is_sellable,
        is_master,
        created_at
      )
    `
    )
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .neq("id", parentItemId)
    .in("item_type", [...allowedTypes])
    .order("name")
    .limit(500);

  if (error) return { error: error.message };

  const candidates: CompositionComponentCandidate[] = (data ?? []).map((row) => {
    const variants = (row.item_variants ?? []) as Array<{
      id: string;
      sku: string;
      price: string | number | null;
      is_sellable: boolean;
      is_master: boolean;
      created_at: string;
    }>;
    const preferred =
      variants.find((v) => v.is_sellable) ??
      variants.find((v) => v.is_master) ??
      variants[0] ??
      null;
    const rawPrice = preferred?.price;
    const defaultSellingPrice =
      rawPrice === null || rawPrice === undefined || rawPrice === ""
        ? null
        : String(rawPrice);

    return {
      id: row.id as string,
      name: row.name as string,
      item_type: row.item_type as ItemType,
      classification: row.classification as ItemClassification,
      default_variant_id: preferred?.id ?? null,
      default_sku: preferred?.sku ?? null,
      default_selling_price: defaultSellingPrice,
    };
  });

  return { data: candidates };
}

export async function getItemComposition(
  itemId: string
): Promise<{ data: ItemCompositionData } | { error: string }> {
  if (!itemId.trim()) return { error: "Product id is required." };

  const { supabase, tenantId } = await requireTenantMutation();
  const { data, error } = await supabase
    .from("item_composition_lines")
    .select(
      `
      id,
      parent_variant_id,
      component_item_id,
      component_variant_id,
      quantity,
      is_mandatory,
      is_optional_addon,
      default_selected,
      unit_price,
      price_mode,
      sort_order,
      component_item:items!item_composition_lines_component_item_tenant_fk (
        name,
        item_type
      ),
      component_variant:item_variants!item_composition_lines_component_variant_tenant_fk (
        sku
      )
    `
    )
    .eq("tenant_id", tenantId)
    .eq("parent_item_id", itemId)
    .order("sort_order", { ascending: true });

  if (error) {
    if (error.code === "42P01") {
      return { error: formatRpcDeployError("item_composition_lines") };
    }
    return { error: error.message };
  }

  return { data: { lines: mapCompositionLineRows(data) } };
}

export async function saveItemComposition(
  itemId: string,
  rows: Array<{
    parent_variant_id: string | null;
    component_item_id: string;
    component_variant_id: string | null;
    quantity: number;
    is_mandatory: boolean;
    is_optional_addon: boolean;
    default_selected: boolean;
    unit_price: number;
    price_mode: CompositionPriceMode;
    sort_order: number;
  }>
) {
  if (!itemId.trim()) return { error: "Product id is required." };

  const validationMessage = validateCompositionDraftRows(rows);
  if (validationMessage) return { error: validationMessage };

  const { supabase } = await requireTenantMutation();
  const { error } = await supabase.rpc("save_item_composition_lines", {
    p_parent_item_id: itemId,
    p_rows: rows.map((row, index) => ({
      parent_variant_id: row.parent_variant_id,
      component_item_id: row.component_item_id,
      component_variant_id: row.component_variant_id,
      quantity: row.quantity,
      is_mandatory: row.is_mandatory,
      is_optional_addon: row.is_optional_addon,
      default_selected: row.is_optional_addon ? row.default_selected : true,
      unit_price: row.price_mode === "COMPLIMENTARY" ? 0 : row.unit_price,
      price_mode: row.price_mode,
      sort_order: row.sort_order ?? index,
    })),
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("save_item_composition_lines") };
    }
    return { error: error.message };
  }

  revalidatePath("/items");
  return { success: true as const };
}

export async function getPriceBookEntries(
  itemId: string
): Promise<{ data: PriceBookEntryData } | { error: string }> {
  if (!itemId.trim()) return { error: "Product id is required." };

  const { supabase, tenantId } = await requireTenantMutation();
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

  const { supabase } = await requireTenantMutation();
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

  revalidatePath("/items");
  return { success: true as const };
}

export async function saveItemVariantAxes(itemId: string, axes: string[]) {
  if (!itemId.trim()) return { error: "Product id is required." };

  const { supabase } = await requireTenantMutation();
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

  revalidatePath("/items");
  return { success: true as const };
}

export async function deleteItemVariant(variantId: string) {
  const { supabase } = await requireTenantMutation();

  const { error } = await supabase.rpc("delete_item_variant", {
    p_variant_id: variantId,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("delete_item_variant") };
    }
    return { error: error.message };
  }

  revalidatePath("/items");
  return { success: true as const };
}

export async function saveItemMedia(raw: unknown) {
  const parsed = itemMediaSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid media profile" };
  }

  const values = parsed.data;
  const { supabase } = await requireTenantMutation();

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

  revalidatePath("/items");
  return { success: true as const, mediaId: data as string };
}

export async function deleteItemMedia(mediaId: string, storagePath?: string) {
  const { supabase } = await requireTenantMutation();

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

  revalidatePath("/items");
  return { success: true as const };
}

export async function saveProductListUserPrefs(raw: unknown) {
  const { supabase } = await requireTenantMutation();

  const { coerceProductListPrefs, DEFAULT_SHOW_VARIANTS } = await import(
    "@/lib/products/list-prefs"
  );
  const prefs = {
    ...coerceProductListPrefs(raw),
    showVariants: DEFAULT_SHOW_VARIANTS,
  };

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

export type TaxCodeOption = {
  id: string;
  code: string;
  name: string;
  rate: string;
  kind: string;
  is_variable: boolean;
  pickerLabel: string;
  pickerDescription: string;
};

export async function fetchActiveTaxCodeOptions(options?: {
  includeTaxCodeId?: string | null;
}): Promise<{ options: TaxCodeOption[] } | { error: string }> {
  const { supabase, tenantId } = await requireTenantMutation();

  const { data, error } = await supabase
    .from("tax_codes")
    .select("id, code, name, rate, kind, is_variable")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("name");

  if (error) return { error: error.message };

  const pickerOptions = resolveItemTaxCodePickerOptions(
    (data ?? []).map((row) => ({
      id: row.id as string,
      code: row.code as string,
      name: row.name as string,
      rate: Number(row.rate),
      kind: row.kind as string,
      is_variable: Boolean(row.is_variable),
    })),
    { includeTaxCodeId: options?.includeTaxCodeId }
  );

  return {
    options: pickerOptions.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      rate: String(row.rate),
      kind: row.kind,
      is_variable: row.is_variable,
      pickerLabel: row.pickerLabel,
      pickerDescription: row.pickerDescription,
    })),
  };
}

export type ResolveBulkTargetInput = {
  selectAllMatching: boolean;
  selectedIds: string[];
  filteredItemIds?: string[] | null;
  categoryId?: string | null;
};

export async function resolveBulkTargetItemIds(input: ResolveBulkTargetInput) {
  const { supabase, tenantId } = await requireTenantMutation();

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

  const { supabase } = await requireTenantMutation();
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

  revalidatePath("/items");
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

  const { supabase } = await requireTenantMutation();

  const { data, error } = await supabase.rpc("bulk_sync_item_jurisdiction", {
    p_item_ids: idsResult.itemIds,
    p_category_id: parsed.data.category_id,
    p_tax_code_id: parsed.data.tax_code_id,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("bulk_sync_item_jurisdiction") };
    }
    return { error: error.message };
  }

  revalidatePath("/items");
  return { success: true as const, affectedCount: (data as number) ?? idsResult.itemIds.length };
}

export async function bulkArchiveItems(target: ResolveBulkTargetInput) {
  const idsResult = await resolveBulkItemIds(target);
  if ("error" in idsResult) return { error: idsResult.error };

  const { supabase } = await requireTenantMutation();

  const { data, error } = await supabase.rpc("bulk_archive_items", {
    p_item_ids: idsResult.itemIds,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("bulk_archive_items") };
    }
    return { error: error.message };
  }

  revalidatePath("/items");
  return { success: true as const, affectedCount: (data as number) ?? idsResult.itemIds.length };
}

async function runBulkRpc(
  target: ResolveBulkTargetInput,
  rpc: string,
  params: Record<string, unknown>
) {
  const idsResult = await resolveBulkItemIds(target);
  if ("error" in idsResult) return { error: idsResult.error };

  const { supabase } = await requireTenantMutation();
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

  revalidatePath("/items");
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
