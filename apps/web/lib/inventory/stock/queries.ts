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
} from "@/lib/inventory/stock/types";

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
      tenant_locations!inner (name, code),
      items!inner (name, base_unit_of_measure, custom_fields, track_inventory),
      item_variants!inner (sku, is_active)
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
        items (name),
        item_variants (sku)
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
      items!inner (name, track_inventory, tracking_mode, custom_fields)
    `
    )
    .eq("tenant_id", tenantId)
    .eq("sku", trimmed)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const item = resolveJoin(
    data.items as
      | {
          name: string;
          track_inventory: boolean;
          tracking_mode: string;
          custom_fields: Record<string, unknown> | null;
        }
      | {
          name: string;
          track_inventory: boolean;
          tracking_mode: string;
          custom_fields: Record<string, unknown> | null;
        }[]
      | null
  );

  const standardCostRaw = item?.custom_fields?.standard_cost;
  const standardCost =
    standardCostRaw != null && String(standardCostRaw).trim() !== ""
      ? String(standardCostRaw).trim()
      : null;

  return {
    variant_id: data.id as string,
    item_id: data.item_id as string,
    item_name: item?.name ?? "",
    variant_sku: data.sku as string,
    track_inventory: Boolean(item?.track_inventory),
    tracking_mode: item?.tracking_mode ?? "NONE",
    standard_cost: standardCost,
  };
}
