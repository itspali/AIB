import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  GoodsInTransitLineRow,
  GoodsInTransitRow,
  GoodsInTransitStatus,
} from "@/lib/procurement/git/types";

function formatDecimal(value: number | string | null | undefined): string {
  if (value == null || value === "") return "0";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : "0";
}

type RawGitRow = {
  id: string;
  voucher_number: string;
  status: string;
  source_location_id: string;
  git_holding_location_id: string;
  destination_location_id: string | null;
  purchase_order_id: string | null;
  posted_at: string | null;
  cleared_at: string | null;
  created_at: string;
  notes: string | null;
};

type RawGitLineRow = {
  id: string;
  item_id: string;
  variant_id: string;
  po_item_id: string | null;
  quantity: number | string;
  unit_cost: number | string;
};

async function fetchLocationNameMap(
  supabase: SupabaseClient,
  tenantId: string,
  locationIds: string[]
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(locationIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const { data } = await supabase
    .from("tenant_locations")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .in("id", uniqueIds);

  return new Map((data ?? []).map((row) => [String(row.id), String(row.name)]));
}

async function fetchPoNumberMap(
  supabase: SupabaseClient,
  tenantId: string,
  poIds: string[]
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(poIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const { data } = await supabase
    .from("purchase_orders")
    .select("id, voucher_number")
    .eq("tenant_id", tenantId)
    .in("id", uniqueIds);

  return new Map((data ?? []).map((row) => [String(row.id), String(row.voucher_number)]));
}

async function enrichGitRows(
  supabase: SupabaseClient,
  tenantId: string,
  rows: RawGitRow[],
  lineCounts: Map<string, number>
): Promise<GoodsInTransitRow[]> {
  const locationIds = rows.flatMap((row) => [
    row.source_location_id,
    row.git_holding_location_id,
    row.destination_location_id ?? "",
  ]);
  const poIds = rows.map((row) => row.purchase_order_id ?? "");
  const [locationNames, poNumbers] = await Promise.all([
    fetchLocationNameMap(supabase, tenantId, locationIds),
    fetchPoNumberMap(supabase, tenantId, poIds),
  ]);

  return rows.map((row) => {
    const status = row.status as GoodsInTransitStatus;
    return {
      id: row.id,
      voucher_number: row.voucher_number,
      status:
        status === "POSTED" || status === "CLEARED" || status === "CANCELLED" ? status : "DRAFT",
      source_location_id: row.source_location_id,
      source_location_name: locationNames.get(row.source_location_id) ?? "",
      git_holding_location_id: row.git_holding_location_id,
      git_holding_location_name: locationNames.get(row.git_holding_location_id) ?? "",
      destination_location_id: row.destination_location_id,
      destination_location_name: row.destination_location_id
        ? locationNames.get(row.destination_location_id) ?? null
        : null,
      purchase_order_id: row.purchase_order_id,
      purchase_order_number: row.purchase_order_id
        ? poNumbers.get(row.purchase_order_id) ?? null
        : null,
      line_count: lineCounts.get(row.id) ?? 0,
      posted_at: row.posted_at,
      cleared_at: row.cleared_at,
      created_at: row.created_at,
      notes: row.notes,
    };
  });
}

export async function fetchGoodsInTransitVouchers(
  supabase: SupabaseClient,
  tenantId: string,
  options?: { status?: GoodsInTransitStatus; purchaseOrderId?: string }
): Promise<GoodsInTransitRow[]> {
  let query = supabase
    .from("goods_in_transit_vouchers")
    .select(
      "id, voucher_number, status, source_location_id, git_holding_location_id, destination_location_id, purchase_order_id, posted_at, cleared_at, created_at, notes"
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (options?.status) query = query.eq("status", options.status);
  if (options?.purchaseOrderId) query = query.eq("purchase_order_id", options.purchaseOrderId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as RawGitRow[];
  const voucherIds = rows.map((row) => row.id);
  const lineCounts = new Map<string, number>();

  if (voucherIds.length > 0) {
    const { data: lineRows } = await supabase
      .from("goods_in_transit_voucher_items")
      .select("goods_in_transit_voucher_id")
      .eq("tenant_id", tenantId)
      .in("goods_in_transit_voucher_id", voucherIds);

    for (const line of lineRows ?? []) {
      const voucherId = String(line.goods_in_transit_voucher_id);
      lineCounts.set(voucherId, (lineCounts.get(voucherId) ?? 0) + 1);
    }
  }

  return enrichGitRows(supabase, tenantId, rows, lineCounts);
}

export async function fetchGoodsInTransitVoucherById(
  supabase: SupabaseClient,
  tenantId: string,
  voucherId: string
): Promise<GoodsInTransitRow | null> {
  const { data, error } = await supabase
    .from("goods_in_transit_vouchers")
    .select(
      "id, voucher_number, status, source_location_id, git_holding_location_id, destination_location_id, purchase_order_id, posted_at, cleared_at, created_at, notes"
    )
    .eq("tenant_id", tenantId)
    .eq("id", voucherId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as RawGitRow;
  const [mapped] = await enrichGitRows(supabase, tenantId, [row], new Map([[row.id, 0]]));

  const { data: lineData, error: lineError } = await supabase
    .from("goods_in_transit_voucher_items")
    .select("id, item_id, variant_id, po_item_id, quantity, unit_cost")
    .eq("tenant_id", tenantId)
    .eq("goods_in_transit_voucher_id", voucherId);

  if (lineError) throw new Error(lineError.message);

  const lines = (lineData ?? []) as RawGitLineRow[];
  const itemIds = lines.map((line) => line.item_id);
  const variantIds = lines.map((line) => line.variant_id);

  const [{ data: items }, { data: variants }] = await Promise.all([
    itemIds.length
      ? supabase.from("items").select("id, name").eq("tenant_id", tenantId).in("id", itemIds)
      : Promise.resolve({ data: [] }),
    variantIds.length
      ? supabase
          .from("item_variants")
          .select("id, sku")
          .eq("tenant_id", tenantId)
          .in("id", variantIds)
      : Promise.resolve({ data: [] }),
  ]);

  const itemNames = new Map((items ?? []).map((item) => [String(item.id), String(item.name)]));
  const variantSkus = new Map((variants ?? []).map((v) => [String(v.id), String(v.sku)]));

  mapped.lines = lines.map(
    (line): GoodsInTransitLineRow => ({
      id: line.id,
      item_id: line.item_id,
      item_name: itemNames.get(line.item_id) ?? "",
      variant_id: line.variant_id,
      variant_sku: variantSkus.get(line.variant_id) ?? "",
      po_item_id: line.po_item_id,
      quantity: formatDecimal(line.quantity),
      unit_cost: formatDecimal(line.unit_cost),
    })
  );
  mapped.line_count = mapped.lines.length;

  return mapped;
}

export async function fetchGitHoldingLocations(
  supabase: SupabaseClient,
  tenantId: string
): Promise<Array<{ id: string; name: string; code: string }>> {
  const { data, error } = await supabase
    .from("tenant_locations")
    .select("id, name, code")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .eq("is_stock_holding", true)
    .eq("is_git_holding", true)
    .order("name");

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    code: (row.code as string) ?? "",
  }));
}

export async function fetchSubcontractWipLocations(
  supabase: SupabaseClient,
  tenantId: string
): Promise<Array<{ id: string; name: string; code: string }>> {
  const { data, error } = await supabase
    .from("tenant_locations")
    .select("id, name, code")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .eq("is_stock_holding", true)
    .eq("is_subcontract_wip", true)
    .order("name");

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    code: (row.code as string) ?? "",
  }));
}
