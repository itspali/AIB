import type { SupabaseClient } from "@supabase/supabase-js";

function formatDecimal(value: number | string | null | undefined, fallback = "0"): string {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return String(parsed);
}
import type {
  StockAdjustmentLineRow,
  StockAdjustmentRow,
  StockBalanceRow,
  StockLocationOption,
  StockVariantOption,
} from "@/lib/inventory/stock/types";
import { resolveStockVariantBlockedReason } from "@/lib/inventory/stock/variant-eligibility";
import {
  extractDefaultPurchasePriceFromCustomFieldsRecord,
  extractMrpFromCustomFieldsRecord,
  filterUserCustomFieldEntries,
} from "@/lib/products/catalog-reserved-fields";
import { resolveProductMediaSignedUrls } from "@/lib/products/media";
import { pickPrimaryImageStoragePath } from "@/lib/products/primary-image";
import { COMMERCE_DEFAULT_PURCHASE_UOM_KEY } from "@/lib/products/item-uom-commerce";
import { listVariantAttributeEntries } from "@/lib/products/list-row-key";
import { parseDefaultPurchaseUomFromCustomFields } from "@/lib/procurement/purchase-orders/po-line-uom-options";

/** Disambiguate composite tenant FK embeds on item_valuations. */
const VALUATION_LOCATION_EMBED = "tenant_locations!item_valuations_location_tenant_fk";
const VALUATION_ITEM_EMBED = "items!item_valuations_item_tenant_fk";
const VALUATION_VARIANT_EMBED = "item_variants!item_valuations_variant_tenant_fk";
const VARIANT_ITEM_EMBED = "items!item_variants_item_tenant_fk";

type BalanceDbRow = {
  id: string;
  location_id: string;
  item_id: string;
  variant_id: string;
  total_quantity_on_hand: number | string;
  current_average_cost: number | string;
  tenant_locations: { name: string; code: string } | { name: string; code: string }[] | null;
  items: {
    name: string;
    base_unit_of_measure: string;
    custom_fields: Record<string, unknown> | null;
  } | {
    name: string;
    base_unit_of_measure: string;
    custom_fields: Record<string, unknown> | null;
  }[] | null;
  item_variants: { sku: string } | { sku: string }[] | null;
};

type AdjustmentDbRow = {
  id: string;
  location_id: string;
  adjustment_number: string;
  kind: string;
  reason: string;
  notes: string | null;
  posted_at: string;
  tenant_locations: { name: string; code: string } | { name: string; code: string }[] | null;
  stock_adjustment_lines: Array<{ id: string }> | null;
};

type AdjustmentLineDbRow = {
  id: string;
  item_id: string;
  variant_id: string;
  quantity_delta: number | string;
  unit_cost: number | string;
  line_notes: string | null;
  items: { name: string } | { name: string }[] | null;
  item_variants: { sku: string } | { sku: string }[] | null;
};

function resolveJoin<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function extractReorderPoint(customFields: Record<string, unknown> | null | undefined): string | null {
  if (!customFields) return null;
  const raw = customFields.reorder_point ?? customFields.reorder_point_qty;
  if (raw == null) return null;
  const text = String(raw).trim();
  return text || null;
}

export async function fetchStockLocationLabel(
  supabase: SupabaseClient,
  tenantId: string,
  locationId: string
): Promise<{ locationId: string; locationName: string; locationCode: string } | null> {
  const { data, error } = await supabase
    .from("tenant_locations")
    .select("id, name, code")
    .eq("tenant_id", tenantId)
    .eq("id", locationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    locationId: data.id as string,
    locationName: data.name as string,
    locationCode: (data.code as string) ?? "",
  };
}

export async function fetchStockLocations(
  supabase: SupabaseClient,
  tenantId: string
): Promise<StockLocationOption[]> {
  const { data, error } = await supabase
    .from("tenant_locations")
    .select("id, name, code")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .eq("is_stock_holding", true)
    .neq("presence_type", "VIRTUAL")
    .order("name");

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    code: row.code as string,
  }));
}

export async function fetchStockBalances(
  supabase: SupabaseClient,
  tenantId: string,
  options?: { locationId?: string | null; search?: string }
): Promise<StockBalanceRow[]> {
  let query = supabase
    .from("item_valuations")
    .select(
      `
      id,
      location_id,
      item_id,
      variant_id,
      total_quantity_on_hand,
      current_average_cost,
      ${VALUATION_LOCATION_EMBED} (name, code),
      ${VALUATION_ITEM_EMBED}!inner (name, base_unit_of_measure, custom_fields, track_inventory),
      ${VALUATION_VARIANT_EMBED}!inner (sku, is_active)
    `
    )
    .eq("tenant_id", tenantId)
    .eq("items.track_inventory", true)
    .eq("item_variants.is_active", true)
    .order("tenant_locations(name)", { ascending: true });

  if (options?.locationId) {
    query = query.eq("location_id", options.locationId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as BalanceDbRow[];
  const search = options?.search?.trim().toLowerCase() ?? "";

  const mapped = rows.map((row) => {
    const location = resolveJoin(row.tenant_locations);
    const item = resolveJoin(row.items);
    const variant = resolveJoin(row.item_variants);
    const onHand = formatDecimal(row.total_quantity_on_hand, "0");
    const reorderPoint = extractReorderPoint(
      (item?.custom_fields as Record<string, unknown> | null) ?? null
    );
    const reorderNum = reorderPoint != null ? Number(reorderPoint) : null;
    const onHandNum = Number(onHand);
    const belowReorder =
      reorderNum != null &&
      Number.isFinite(reorderNum) &&
      Number.isFinite(onHandNum) &&
      onHandNum <= reorderNum;

    return {
      id: row.id,
      location_id: row.location_id,
      location_name: location?.name ?? "",
      location_code: location?.code ?? "",
      item_id: row.item_id,
      item_name: item?.name ?? "",
      variant_id: row.variant_id,
      variant_sku: variant?.sku ?? "",
      base_unit_of_measure: item?.base_unit_of_measure ?? "",
      total_quantity_on_hand: onHand,
      current_average_cost: formatDecimal(row.current_average_cost, "0"),
      reorder_point: reorderPoint,
      below_reorder: belowReorder,
    } satisfies StockBalanceRow;
  });

  if (!search) return mapped;

  return mapped.filter((row) => {
    const haystack = [
      row.location_name,
      row.location_code,
      row.item_name,
      row.variant_sku,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(search);
  });
}

export async function fetchStockAdjustments(
  supabase: SupabaseClient,
  tenantId: string,
  options?: { locationId?: string | null; search?: string }
): Promise<StockAdjustmentRow[]> {
  let query = supabase
    .from("stock_adjustments")
    .select(
      `
      id,
      location_id,
      adjustment_number,
      kind,
      reason,
      notes,
      posted_at,
      tenant_locations!inner (name, code),
      stock_adjustment_lines (id)
    `
    )
    .eq("tenant_id", tenantId)
    .order("posted_at", { ascending: false });

  if (options?.locationId) {
    query = query.eq("location_id", options.locationId);
  }

  const { data, error } = await query.limit(200);
  if (error) throw new Error(error.message);

  const search = options?.search?.trim().toLowerCase() ?? "";

  const mapped = ((data ?? []) as AdjustmentDbRow[]).map((row) => {
    const location = resolveJoin(row.tenant_locations);
    const lineCount = row.stock_adjustment_lines?.length ?? 0;
    return {
      id: row.id,
      location_id: row.location_id,
      location_name: location?.name ?? "",
      location_code: location?.code ?? "",
      adjustment_number: row.adjustment_number,
      kind: row.kind as StockAdjustmentRow["kind"],
      reason: row.reason,
      notes: row.notes,
      posted_at: row.posted_at,
      line_count: lineCount,
    } satisfies StockAdjustmentRow;
  });

  if (!search) return mapped;

  return mapped.filter((row) => {
    const haystack = [
      row.adjustment_number,
      row.location_name,
      row.location_code,
      row.reason,
      row.kind,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(search);
  });
}

export async function fetchStockAdjustmentById(
  supabase: SupabaseClient,
  tenantId: string,
  adjustmentId: string
): Promise<StockAdjustmentRow | null> {
  const { data, error } = await supabase
    .from("stock_adjustments")
    .select(
      `
      id,
      location_id,
      adjustment_number,
      kind,
      reason,
      notes,
      posted_at,
      tenant_locations!inner (name, code),
      stock_adjustment_lines (
        id,
        item_id,
        variant_id,
        quantity_delta,
        unit_cost,
        line_notes,
        items!stock_adjustment_lines_item_id_fkey (name),
        item_variants!stock_adjustment_lines_variant_id_fkey (sku)
      )
    `
    )
    .eq("tenant_id", tenantId)
    .eq("id", adjustmentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as Omit<AdjustmentDbRow, "stock_adjustment_lines"> & {
    stock_adjustment_lines: AdjustmentLineDbRow[] | null;
  };
  const location = resolveJoin(row.tenant_locations);
  const lines = (row.stock_adjustment_lines ?? []).map((line: AdjustmentLineDbRow) => {
    const item = resolveJoin(line.items);
    const variant = resolveJoin(line.item_variants);
    return {
      id: line.id,
      item_id: line.item_id,
      item_name: item?.name ?? "",
      variant_id: line.variant_id,
      variant_sku: variant?.sku ?? "",
      quantity_delta: formatDecimal(line.quantity_delta, "0"),
      unit_cost: formatDecimal(line.unit_cost, "0"),
      line_notes: line.line_notes,
    } satisfies StockAdjustmentLineRow;
  });

  return {
    id: row.id,
    location_id: row.location_id,
    location_name: location?.name ?? "",
    location_code: location?.code ?? "",
    adjustment_number: row.adjustment_number,
    kind: row.kind as StockAdjustmentRow["kind"],
    reason: row.reason,
    notes: row.notes,
    posted_at: row.posted_at,
    line_count: lines.length,
    lines,
  };
}

type VariantItemJoin = {
  name: string;
  description: string | null;
  hsn_sac_code: string | null;
  track_inventory: boolean;
  tracking_mode: string;
  base_unit_of_measure: string;
  custom_fields: Record<string, unknown> | null;
};

type VariantSearchDbRow = {
  id: string;
  sku: string;
  item_id: string;
  is_sellable: boolean;
  variant_attributes: Record<string, unknown> | null;
  items: VariantItemJoin | VariantItemJoin[] | null;
};

function mapSuggestionCustomFields(
  raw: Record<string, unknown> | null | undefined
): Record<string, string> {
  if (!raw) return {};
  const entries = Object.entries(raw).map(([key, value]) => ({
    key,
    value: value == null ? "" : String(value),
  }));
  const fields = Object.fromEntries(
    filterUserCustomFieldEntries(entries).map((row) => [row.key, row.value])
  );
  const purchaseUom = parseDefaultPurchaseUomFromCustomFields(raw);
  if (purchaseUom) {
    fields[COMMERCE_DEFAULT_PURCHASE_UOM_KEY] = purchaseUom;
  }
  return fields;
}

function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

function extractStandardCost(customFields: Record<string, unknown> | null | undefined): string | null {
  const raw = customFields?.standard_cost;
  if (raw == null || String(raw).trim() === "") return null;
  return String(raw).trim();
}

function mapVariantSearchResult(row: VariantSearchDbRow): StockVariantOption {
  const item = resolveJoin(row.items);
  const blockedReason = resolveStockVariantBlockedReason({
    is_sellable: row.is_sellable,
    track_inventory: item?.track_inventory,
    tracking_mode: item?.tracking_mode,
  });
  return {
    variant_id: row.id,
    item_id: row.item_id,
    item_name: item?.name ?? "",
    variant_sku: row.sku,
    standard_cost: extractStandardCost(item?.custom_fields ?? null),
    purchase_price: extractDefaultPurchasePriceFromCustomFieldsRecord(
      item?.custom_fields ?? null
    ) || null,
    adjustable: blockedReason == null,
    blocked_reason: blockedReason,
    image_url: null,
    base_unit_of_measure: item?.base_unit_of_measure?.trim() || null,
    description: item?.description?.trim() || null,
    hsn_sac_code: item?.hsn_sac_code?.trim() || null,
    mrp: extractMrpFromCustomFieldsRecord(item?.custom_fields) || null,
    variant_attributes: Object.fromEntries(listVariantAttributeEntries(row.variant_attributes)),
    custom_fields: mapSuggestionCustomFields(item?.custom_fields),
  };
}

type VariantSuggestionMediaRow = {
  item_id: string;
  variant_id: string | null;
  storage_url: string;
  sort_order: number;
  is_primary: boolean;
};

type VariantSuggestionMasterRow = {
  id: string;
  item_id: string;
  is_master: boolean | null;
};

async function attachStockVariantSuggestionImages(
  supabase: SupabaseClient,
  tenantId: string,
  options: StockVariantOption[]
): Promise<StockVariantOption[]> {
  if (!options.length) return options;

  const itemIds = [...new Set(options.map((option) => option.item_id))];
  const [{ data: mediaRows, error: mediaError }, { data: variantRows, error: variantError }] =
    await Promise.all([
      supabase
        .from("item_media")
        .select("item_id, variant_id, storage_url, sort_order, is_primary")
        .eq("tenant_id", tenantId)
        .in("item_id", itemIds),
      supabase
        .from("item_variants")
        .select("id, item_id, is_master")
        .eq("tenant_id", tenantId)
        .in("item_id", itemIds)
        .eq("is_active", true),
    ]);

  if (mediaError) throw new Error(mediaError.message);
  if (variantError) throw new Error(variantError.message);

  const mediaByItem = new Map<string, VariantSuggestionMediaRow[]>();
  for (const row of (mediaRows ?? []) as VariantSuggestionMediaRow[]) {
    const list = mediaByItem.get(row.item_id) ?? [];
    list.push(row);
    mediaByItem.set(row.item_id, list);
  }

  const variantsByItem = new Map<string, VariantSuggestionMasterRow[]>();
  for (const row of (variantRows ?? []) as VariantSuggestionMasterRow[]) {
    const list = variantsByItem.get(row.item_id) ?? [];
    list.push(row);
    variantsByItem.set(row.item_id, list);
  }

  const pathByVariantId = new Map<string, string>();
  for (const option of options) {
    const storagePath = pickPrimaryImageStoragePath(
      mediaByItem.get(option.item_id) ?? [],
      option.variant_id,
      variantsByItem.get(option.item_id) ?? undefined
    );
    if (storagePath) {
      pathByVariantId.set(option.variant_id, storagePath);
    }
  }

  const signedUrls = await resolveProductMediaSignedUrls(
    supabase,
    [...new Set(pathByVariantId.values())]
  );

  return options.map((option) => {
    const storagePath = pathByVariantId.get(option.variant_id);
    return {
      ...option,
      image_url: storagePath ? signedUrls.get(storagePath) ?? null : null,
    };
  });
}

function tokenizeStockSearchQuery(query: string): string[] {
  return query
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

const VARIANT_SEARCH_SELECT = `
  id,
  sku,
  item_id,
  is_sellable,
  variant_attributes,
  ${VARIANT_ITEM_EMBED}!inner (name, description, hsn_sac_code, track_inventory, tracking_mode, base_unit_of_measure, custom_fields)
`;

async function queryVariantSearchResults(
  supabase: SupabaseClient,
  tenantId: string,
  filter: { skuPattern?: string; itemIds?: string[] },
  limit: number
): Promise<StockVariantOption[]> {
  let query = supabase
    .from("item_variants")
    .select(VARIANT_SEARCH_SELECT)
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  if (filter.skuPattern) {
    query = query.ilike("sku", filter.skuPattern);
  }
  if (filter.itemIds?.length) {
    query = query.in("item_id", filter.itemIds);
  }

  const { data, error } = await query.order("sku", { ascending: true }).limit(limit);
  if (error) throw new Error(error.message);

  return ((data ?? []) as VariantSearchDbRow[]).map((row) => mapVariantSearchResult(row));
}

async function collectVariantsForToken(
  supabase: SupabaseClient,
  tenantId: string,
  token: string,
  perQueryLimit: number
): Promise<StockVariantOption[]> {
  const pattern = `%${escapeIlikePattern(token)}%`;

  const [bySku, matchingItems] = await Promise.all([
    queryVariantSearchResults(supabase, tenantId, { skuPattern: pattern }, perQueryLimit),
    supabase
      .from("items")
      .select("id")
      .eq("tenant_id", tenantId)
      .ilike("name", pattern)
      .limit(8),
  ]);

  let byName: StockVariantOption[] = [];
  const itemIds = (matchingItems.data ?? []).map((row) => row.id as string);
  if (!matchingItems.error && itemIds.length > 0) {
    byName = await queryVariantSearchResults(supabase, tenantId, { itemIds }, perQueryLimit);
  }

  const merged = new Map<string, StockVariantOption>();
  for (const option of [...bySku, ...byName]) {
    merged.set(option.variant_id, option);
  }
  return [...merged.values()];
}

function rankStockVariantResults(options: StockVariantOption[], query: string): StockVariantOption[] {
  const normalized = query.trim().toLowerCase();
  const tokens = tokenizeStockSearchQuery(query).map((token) => token.toLowerCase());

  return [...options].sort((left, right) => {
    if (left.adjustable !== right.adjustable) return left.adjustable ? -1 : 1;

    const leftSku = left.variant_sku.toLowerCase();
    const rightSku = right.variant_sku.toLowerCase();
    const leftExact = leftSku === normalized;
    const rightExact = rightSku === normalized;
    if (leftExact !== rightExact) return leftExact ? -1 : 1;

    const leftPrefix = tokens.some((token) => leftSku.startsWith(token));
    const rightPrefix = tokens.some((token) => rightSku.startsWith(token));
    if (leftPrefix !== rightPrefix) return leftPrefix ? -1 : 1;

    const leftName = left.item_name.toLowerCase();
    const rightName = right.item_name.toLowerCase();
    const leftNameHit = tokens.some((token) => leftName.includes(token));
    const rightNameHit = tokens.some((token) => rightName.includes(token));
    if (leftNameHit !== rightNameHit) return leftNameHit ? -1 : 1;

    return left.variant_sku.localeCompare(right.variant_sku);
  });
}

function sortStockVariantsAlphabetically(options: StockVariantOption[]): StockVariantOption[] {
  return [...options].sort((left, right) => {
    const nameCompare = left.item_name.localeCompare(right.item_name, undefined, {
      sensitivity: "base",
    });
    if (nameCompare !== 0) return nameCompare;
    return left.variant_sku.localeCompare(right.variant_sku, undefined, { sensitivity: "base" });
  });
}

export async function listStockVariantsForBrowse(
  supabase: SupabaseClient,
  tenantId: string,
  options?: { limit?: number }
): Promise<StockVariantOption[]> {
  const limit = options?.limit ?? 50;
  const { data, error } = await supabase
    .from("item_variants")
    .select(VARIANT_SEARCH_SELECT)
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("sku", { ascending: true })
    .limit(Math.max(limit * 3, 150));

  if (error) throw new Error(error.message);

  return attachStockVariantSuggestionImages(
    supabase,
    tenantId,
    sortStockVariantsAlphabetically(
      ((data ?? []) as VariantSearchDbRow[])
        .map((row) => mapVariantSearchResult(row))
        .filter((option) => option.adjustable)
    ).slice(0, limit)
  );
}

export async function searchStockVariants(
  supabase: SupabaseClient,
  tenantId: string,
  query: string,
  options?: { limit?: number }
): Promise<StockVariantOption[]> {
  const trimmed = query.trim();
  if (trimmed.length < 1) return [];

  const limit = options?.limit ?? 15;
  const perQueryLimit = Math.max(limit, 10);
  const tokens = tokenizeStockSearchQuery(trimmed);
  const merged = new Map<string, StockVariantOption>();

  for (const token of tokens) {
    const matches = await collectVariantsForToken(supabase, tenantId, token, perQueryLimit);
    for (const option of matches) {
      merged.set(option.variant_id, option);
    }
  }

  return attachStockVariantSuggestionImages(
    supabase,
    tenantId,
    rankStockVariantResults([...merged.values()], trimmed)
      .filter((option) => option.adjustable)
      .slice(0, limit)
  );
}

export async function resolveVariantBySku(
  supabase: SupabaseClient,
  tenantId: string,
  sku: string
): Promise<
  | {
      variant_id: string;
      item_id: string;
      item_name: string;
      variant_sku: string;
      track_inventory: boolean;
      tracking_mode: string;
      standard_cost: string | null;
      blocked_reason: string | null;
      base_unit_of_measure: string | null;
    }
  | null
> {
  const trimmed = sku.trim();
  if (!trimmed) return null;

  const { data, error } = await supabase
    .from("item_variants")
    .select(
      `
      id,
      sku,
      item_id,
      is_sellable,
      ${VARIANT_ITEM_EMBED}!inner (name, track_inventory, tracking_mode, base_unit_of_measure, custom_fields)
    `
    )
    .eq("tenant_id", tenantId)
    .eq("sku", trimmed)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const mapped = mapVariantSearchResult(data as VariantSearchDbRow);
  const item = resolveJoin((data as VariantSearchDbRow).items);
  return {
    variant_id: mapped.variant_id,
    item_id: mapped.item_id,
    item_name: mapped.item_name,
    variant_sku: mapped.variant_sku,
    track_inventory: Boolean(item?.track_inventory),
    tracking_mode: item?.tracking_mode ?? "NONE",
    standard_cost: mapped.standard_cost,
    blocked_reason: mapped.blocked_reason,
    base_unit_of_measure: mapped.base_unit_of_measure,
  };
}

async function resolveVariantByBarcode(
  supabase: SupabaseClient,
  tenantId: string,
  barcode: string
): Promise<
  | {
      variant_id: string;
      item_id: string;
      item_name: string;
      variant_sku: string;
      track_inventory: boolean;
      tracking_mode: string;
      standard_cost: string | null;
      blocked_reason: string | null;
      base_unit_of_measure: string | null;
    }
  | null
> {
  const trimmed = barcode.trim();
  if (!trimmed) return null;

  const { data, error } = await supabase
    .from("item_variants")
    .select(
      `
      id,
      sku,
      item_id,
      is_sellable,
      ${VARIANT_ITEM_EMBED}!inner (name, track_inventory, tracking_mode, base_unit_of_measure, custom_fields)
    `
    )
    .eq("tenant_id", tenantId)
    .eq("barcode", trimmed)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const mapped = mapVariantSearchResult(data as VariantSearchDbRow);
  const item = resolveJoin((data as VariantSearchDbRow).items);
  return {
    variant_id: mapped.variant_id,
    item_id: mapped.item_id,
    item_name: mapped.item_name,
    variant_sku: mapped.variant_sku,
    track_inventory: Boolean(item?.track_inventory),
    tracking_mode: item?.tracking_mode ?? "NONE",
    standard_cost: mapped.standard_cost,
    blocked_reason: mapped.blocked_reason,
    base_unit_of_measure: mapped.base_unit_of_measure,
  };
}

export async function resolveVariantByScanCode(
  supabase: SupabaseClient,
  tenantId: string,
  code: string,
  policy: "GTIN" | "SKU" | "GTIN_THEN_SKU" = "GTIN_THEN_SKU"
): Promise<
  | {
      variant_id: string;
      item_id: string;
      item_name: string;
      variant_sku: string;
      track_inventory: boolean;
      tracking_mode: string;
      standard_cost: string | null;
      blocked_reason: string | null;
      base_unit_of_measure: string | null;
    }
  | null
> {
  const trimmed = code.trim();
  if (!trimmed) return null;

  switch (policy) {
    case "GTIN":
      return resolveVariantByBarcode(supabase, tenantId, trimmed);
    case "SKU":
      return resolveVariantBySku(supabase, tenantId, trimmed);
    case "GTIN_THEN_SKU":
    default: {
      const byGtin = await resolveVariantByBarcode(supabase, tenantId, trimmed);
      if (byGtin) return byGtin;
      return resolveVariantBySku(supabase, tenantId, trimmed);
    }
  }
}
