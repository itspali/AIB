import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isItemClassification } from "@/lib/products/classification-labels";
import { redactProductListRows } from "@/lib/products/field-permissions";
import { resolveProductMediaSignedUrls } from "@/lib/products/media";
import { isTaxCategory } from "@/lib/products/tax-options";
import type { ProductListRow } from "@/lib/products/types";

import { PRODUCT_LIST_PAGE_SIZE } from "@/lib/products/list-page-size";

const LIST_VIEW = "product_list_workspace_rows";
const DEFAULT_PAGE_SIZE = PRODUCT_LIST_PAGE_SIZE;

type ListViewRow = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  classification: string;
  base_unit_of_measure: string;
  category_id: string | null;
  category_name: string | null;
  hsn_sac_code: string | null;
  has_variants: boolean;
  default_tax_category: string;
  is_active: boolean;
  is_purchasable: boolean;
  is_salable: boolean;
  is_returnable: boolean;
  created_at: string;
  updated_at: string;
  default_variant_id: string | null;
  default_sku: string | null;
  barcode: string | null;
  selling_price: number | string | null;
  purchase_price: number | string | null;
  supplier_name: string | null;
  stock_on_hand: number | string | null;
  primary_image_storage_path: string | null;
};

export type ProductListPage = {
  rows: ProductListRow[];
  totalCount: number;
  pageSize: number;
  hasMore: boolean;
};

function formatDecimal(value: number | string | null | undefined, fallback = "0"): string {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function mapListViewRow(row: ListViewRow, imageUrl: string | null): ProductListRow | null {
  if (!isItemClassification(row.classification)) return null;

  const taxCategory = isTaxCategory(row.default_tax_category)
    ? row.default_tax_category
    : "STANDARD";

  return {
    id: row.id,
    name: row.name,
    image_url: imageUrl,
    description: row.description,
    classification: row.classification,
    base_unit_of_measure: row.base_unit_of_measure,
    category_id: row.category_id,
    category_name: row.category_name,
    hsn_sac_code: row.hsn_sac_code,
    has_variants: row.has_variants,
    default_tax_category: taxCategory,
    is_active: row.is_active,
    is_purchasable: row.is_purchasable,
    is_salable: row.is_salable,
    is_returnable: row.is_returnable,
    default_variant_id: row.default_variant_id,
    default_sku: row.default_sku,
    barcode: row.barcode,
    selling_price: row.selling_price != null ? formatDecimal(row.selling_price) : null,
    purchase_price: row.purchase_price != null ? formatDecimal(row.purchase_price) : null,
    supplier_name: row.supplier_name,
    stock_on_hand: formatDecimal(row.stock_on_hand, "0"),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function signPrimaryImages(
  supabase: SupabaseClient,
  rows: ListViewRow[],
  includeImages: boolean
): Promise<Map<string, string | null>> {
  const images = new Map<string, string | null>();
  if (!includeImages) {
    for (const row of rows) images.set(row.id, null);
    return images;
  }

  const pathByItem = new Map<string, string>();
  for (const row of rows) {
    const path = row.primary_image_storage_path?.trim();
    if (!path) {
      images.set(row.id, null);
      continue;
    }
    if (path.startsWith("http://") || path.startsWith("https://")) {
      images.set(row.id, path);
      continue;
    }
    pathByItem.set(row.id, path);
  }

  const uniquePaths = [...new Set(pathByItem.values())];
  const signedUrls = await resolveProductMediaSignedUrls(supabase, uniquePaths);

  for (const [itemId, path] of pathByItem) {
    images.set(itemId, signedUrls.get(path) ?? null);
  }

  return images;
}

function applyPermissions(
  rows: ProductListRow[],
  permissions?: { allowedFields: readonly string[] }
): ProductListRow[] {
  return permissions ? redactProductListRows(rows, permissions.allowedFields) : rows;
}

async function fetchListViewRows(
  supabase: SupabaseClient,
  tenantId: string,
  options: { offset: number; limit: number; itemIds?: string[] }
): Promise<{ rows: ListViewRow[]; totalCount: number }> {
  let query = supabase
    .from(LIST_VIEW)
    .select("*", { count: "exact" })
    .eq("tenant_id", tenantId)
    .order("name");

  if (options.itemIds?.length) {
    query = query.in("id", options.itemIds);
  } else {
    query = query.range(options.offset, options.offset + options.limit - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    console.warn("[products] product_list_workspace_rows unavailable, using legacy list query:", error.message);
    return { rows: [], totalCount: 0 };
  }

  return {
    rows: (data ?? []) as ListViewRow[],
    totalCount: count ?? (data?.length ?? 0),
  };
}

export async function mapListViewRowsToProductList(
  supabase: SupabaseClient,
  viewRows: ListViewRow[],
  options?: { includeImages?: boolean }
): Promise<ProductListRow[]> {
  const imageUrls = await signPrimaryImages(supabase, viewRows, options?.includeImages ?? false);
  return viewRows
    .map((row) => mapListViewRow(row, imageUrls.get(row.id) ?? null))
    .filter((row): row is ProductListRow => row !== null);
}

export async function fetchProductListPage(
  supabase: SupabaseClient,
  tenantId: string,
  permissions?: { allowedFields: readonly string[] },
  options?: {
    offset?: number;
    limit?: number;
    includeImages?: boolean;
    itemIds?: string[];
  }
): Promise<ProductListPage> {
  const offset = options?.offset ?? 0;
  const limit = options?.limit ?? DEFAULT_PAGE_SIZE;
  const { rows: viewRows, totalCount } = await fetchListViewRows(supabase, tenantId, {
    offset,
    limit,
    itemIds: options?.itemIds,
  });

  if (!viewRows.length && totalCount === 0) {
    const { fetchProductListRows } = await import("@/lib/products/queries");
    const legacyRows = await fetchProductListRows(supabase, tenantId, permissions, {
      includeImages: options?.includeImages,
    });

    if (options?.itemIds?.length) {
      const idSet = new Set(options.itemIds);
      const filtered = legacyRows.filter((row) => idSet.has(row.id));
      return {
        rows: filtered,
        totalCount: filtered.length,
        pageSize: filtered.length,
        hasMore: false,
      };
    }

    if (!options?.itemIds?.length) {
      return {
        rows: legacyRows,
        totalCount: legacyRows.length,
        pageSize: legacyRows.length,
        hasMore: false,
      };
    }
  }

  const mapped = await mapListViewRowsToProductList(supabase, viewRows, {
    includeImages: options?.includeImages,
  });

  return {
    rows: applyPermissions(mapped, permissions),
    totalCount: options?.itemIds?.length ? mapped.length : totalCount,
    pageSize: limit,
    hasMore: options?.itemIds?.length ? false : offset + viewRows.length < totalCount,
  };
}

function chunkIds<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

export async function fetchProductListByIds(
  supabase: SupabaseClient,
  tenantId: string,
  itemIds: string[],
  permissions?: { allowedFields: readonly string[] },
  options?: { includeImages?: boolean }
): Promise<ProductListPage> {
  const uniqueIds = [...new Set(itemIds.filter(Boolean))];
  if (!uniqueIds.length) {
    return { rows: [], totalCount: 0, pageSize: 0, hasMore: false };
  }

  const chunks = chunkIds(uniqueIds, DEFAULT_PAGE_SIZE);
  const rows: ProductListRow[] = [];

  for (const idChunk of chunks) {
    const page = await fetchProductListPage(supabase, tenantId, permissions, {
      itemIds: idChunk,
      includeImages: options?.includeImages,
    });
    rows.push(...page.rows);
  }

  const order = new Map(uniqueIds.map((id, index) => [id, index]));
  rows.sort((a, b) => {
    const byId = (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
    if (byId !== 0) return byId;
    return a.name.localeCompare(b.name);
  });

  return {
    rows,
    totalCount: uniqueIds.length,
    pageSize: uniqueIds.length,
    hasMore: false,
  };
}

export { PRODUCT_LIST_PAGE_SIZE } from "@/lib/products/list-page-size";
