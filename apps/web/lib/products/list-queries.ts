import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isItemClassification } from "@/lib/products/classification-labels";
import { redactProductListRows } from "@/lib/products/field-permissions";
import { resolveProductMediaSignedUrls } from "@/lib/products/media";
import { isTaxCategory } from "@/lib/products/tax-options";
import type { ProductListRow } from "@/lib/products/types";

import { PRODUCT_LIST_PAGE_SIZE } from "@/lib/products/list-page-size";

const MASTER_LIST_VIEW = "product_list_workspace_rows";
const VARIANT_LIST_VIEW = "product_list_workspace_variant_rows";
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
  variant_id?: string | null;
  variant_attributes?: Record<string, unknown> | null;
  variant_is_active?: boolean;
};

export type ProductListPage = {
  rows: ProductListRow[];
  totalCount: number;
  pageSize: number;
  hasMore: boolean;
};

export type ProductListFetchOptions = {
  offset?: number;
  limit?: number;
  includeImages?: boolean;
  itemIds?: string[];
  expandVariants?: boolean;
};

function listViewRowImageKey(row: ListViewRow, expandVariants: boolean): string {
  if (expandVariants && row.variant_id) {
    return `${row.id}:${row.variant_id}`;
  }
  return row.id;
}

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
    variant_id: row.variant_id ?? null,
    variant_attributes: row.variant_attributes ?? null,
    variant_is_active: row.variant_is_active,
  };
}

async function signPrimaryImages(
  supabase: SupabaseClient,
  rows: ListViewRow[],
  includeImages: boolean,
  expandVariants: boolean
): Promise<Map<string, string | null>> {
  const images = new Map<string, string | null>();
  if (!includeImages) {
    for (const row of rows) {
      images.set(listViewRowImageKey(row, expandVariants), null);
    }
    return images;
  }

  const pathByKey = new Map<string, string>();
  for (const row of rows) {
    const key = listViewRowImageKey(row, expandVariants);
    const path = row.primary_image_storage_path?.trim();
    if (!path) {
      images.set(key, null);
      continue;
    }
    if (path.startsWith("http://") || path.startsWith("https://")) {
      images.set(key, path);
      continue;
    }
    pathByKey.set(key, path);
  }

  const uniquePaths = [...new Set(pathByKey.values())];
  const signedUrls = await resolveProductMediaSignedUrls(supabase, uniquePaths);

  for (const [key, path] of pathByKey) {
    images.set(key, signedUrls.get(path) ?? null);
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
  options: { offset: number; limit: number; itemIds?: string[]; expandVariants?: boolean }
): Promise<{ rows: ListViewRow[]; totalCount: number }> {
  const listView = options.expandVariants ? VARIANT_LIST_VIEW : MASTER_LIST_VIEW;

  let query = supabase
    .from(listView)
    .select("*", { count: "exact" })
    .eq("tenant_id", tenantId)
    .order("name")
    .order("default_sku")
    .order("variant_id");

  if (options.itemIds?.length) {
    query = query.in("id", options.itemIds);
  } else {
    query = query.range(options.offset, options.offset + options.limit - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    console.warn(
      `[products] ${listView} unavailable, using legacy list query:`,
      error.message
    );
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
  options?: { includeImages?: boolean; expandVariants?: boolean }
): Promise<ProductListRow[]> {
  const expandVariants = options?.expandVariants ?? false;
  const imageUrls = await signPrimaryImages(
    supabase,
    viewRows,
    options?.includeImages ?? false,
    expandVariants
  );
  return viewRows
    .map((row) =>
      mapListViewRow(row, imageUrls.get(listViewRowImageKey(row, expandVariants)) ?? null)
    )
    .filter((row): row is ProductListRow => row !== null);
}

export async function fetchProductListPage(
  supabase: SupabaseClient,
  tenantId: string,
  permissions?: { allowedFields: readonly string[] },
  options?: ProductListFetchOptions
): Promise<ProductListPage> {
  const offset = options?.offset ?? 0;
  const limit = options?.limit ?? DEFAULT_PAGE_SIZE;
  const expandVariants = options?.expandVariants ?? false;
  const { rows: viewRows, totalCount } = await fetchListViewRows(supabase, tenantId, {
    offset,
    limit,
    itemIds: options?.itemIds,
    expandVariants,
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
    expandVariants,
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

function sortFilteredListRows(rows: ProductListRow[], itemOrder: Map<string, number>): void {
  rows.sort((a, b) => {
    const byId = (itemOrder.get(a.id) ?? 0) - (itemOrder.get(b.id) ?? 0);
    if (byId !== 0) return byId;
    const bySku = (a.default_sku ?? "").localeCompare(b.default_sku ?? "");
    if (bySku !== 0) return bySku;
    return (a.variant_id ?? "").localeCompare(b.variant_id ?? "");
  });
}

export async function fetchProductListByIds(
  supabase: SupabaseClient,
  tenantId: string,
  itemIds: string[],
  permissions?: { allowedFields: readonly string[] },
  options?: Pick<ProductListFetchOptions, "includeImages" | "expandVariants">
): Promise<ProductListPage> {
  const uniqueIds = [...new Set(itemIds.filter(Boolean))];
  if (!uniqueIds.length) {
    return { rows: [], totalCount: 0, pageSize: 0, hasMore: false };
  }

  const expandVariants = options?.expandVariants ?? false;
  const chunks = chunkIds(uniqueIds, DEFAULT_PAGE_SIZE);
  const rows: ProductListRow[] = [];

  for (const idChunk of chunks) {
    const page = await fetchProductListPage(supabase, tenantId, permissions, {
      itemIds: idChunk,
      includeImages: options?.includeImages,
      expandVariants,
    });
    rows.push(...page.rows);
  }

  const order = new Map(uniqueIds.map((id, index) => [id, index]));
  sortFilteredListRows(rows, order);

  return {
    rows,
    totalCount: rows.length,
    pageSize: rows.length,
    hasMore: false,
  };
}

export { PRODUCT_LIST_PAGE_SIZE } from "@/lib/products/list-page-size";
