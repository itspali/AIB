import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  StockTransferRow,
  StockTransferStatus,
  TransferLineRow,
  TransferLocationOption,
} from "@/lib/inventory/transfers/types";

/** Aliased embeds avoid PostgREST duplicate-join errors on tenant_locations ×2. */
const SOURCE_LOCATION_EMBED =
  "source_location:tenant_locations!stock_transfers_source_tenant_fk";
const DESTINATION_LOCATION_EMBED =
  "destination_location:tenant_locations!stock_transfers_destination_tenant_fk";
const TRANSFER_ITEMS_EMBED =
  "transfer_lines:stock_transfer_items!stock_transfer_items_transfer_tenant_fk";

type LocationEmbed = { name: string; code: string } | { name: string; code: string }[] | null;

function formatDecimal(value: number | string | null | undefined, fallback = "0"): string {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return String(parsed);
}

function resolveJoin<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

type TransferListDbRow = {
  id: string;
  transfer_number: string;
  source_location_id: string;
  destination_location_id: string;
  current_status: string;
  dispatched_at: string | null;
  received_at: string | null;
  created_at: string;
  source_location: LocationEmbed;
  destination_location: LocationEmbed;
  transfer_lines: Array<{ id: string }> | null;
};

type TransferLineDbRow = {
  id: string;
  item_id: string;
  variant_id: string;
  quantity_dispatched: number | string;
  quantity_accepted: number | string;
  quantity_damaged: number | string;
  quantity_lost: number | string;
  source_unit_cost_at_dispatch: number | string;
  items: { name: string } | { name: string }[] | null;
  item_variants: { sku: string } | { sku: string }[] | null;
};

export async function fetchTransferLocations(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TransferLocationOption[]> {
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

export async function fetchTransferLocationLabel(
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

function mapTransferListRow(row: TransferListDbRow): StockTransferRow {
  const source = resolveJoin(row.source_location);
  const destination = resolveJoin(row.destination_location);

  return {
    id: row.id,
    transfer_number: row.transfer_number,
    source_location_id: row.source_location_id,
    source_location_name: source?.name ?? "",
    source_location_code: source?.code ?? "",
    destination_location_id: row.destination_location_id,
    destination_location_name: destination?.name ?? "",
    destination_location_code: destination?.code ?? "",
    current_status: row.current_status as StockTransferStatus,
    line_count: row.transfer_lines?.length ?? 0,
    dispatched_at: row.dispatched_at,
    received_at: row.received_at,
    created_at: row.created_at,
  };
}

export async function fetchStockTransfers(
  supabase: SupabaseClient,
  tenantId: string,
  options?: { status?: StockTransferStatus | null; sourceLocationId?: string | null }
): Promise<StockTransferRow[]> {
  let query = supabase
    .from("stock_transfers")
    .select(
      `
      id,
      transfer_number,
      source_location_id,
      destination_location_id,
      current_status,
      dispatched_at,
      received_at,
      created_at,
      ${SOURCE_LOCATION_EMBED} (name, code),
      ${DESTINATION_LOCATION_EMBED} (name, code),
      ${TRANSFER_ITEMS_EMBED} (id)
    `
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (options?.status) {
    query = query.eq("current_status", options.status);
  }

  if (options?.sourceLocationId) {
    query = query.eq("source_location_id", options.sourceLocationId);
  }

  const { data, error } = await query.limit(200);
  if (error) throw new Error(error.message);

  return ((data ?? []) as TransferListDbRow[]).map(mapTransferListRow);
}

export async function fetchStockTransferById(
  supabase: SupabaseClient,
  tenantId: string,
  transferId: string
): Promise<StockTransferRow | null> {
  const { data, error } = await supabase
    .from("stock_transfers")
    .select(
      `
      id,
      transfer_number,
      source_location_id,
      destination_location_id,
      current_status,
      dispatched_at,
      received_at,
      created_at,
      ${SOURCE_LOCATION_EMBED} (name, code),
      ${DESTINATION_LOCATION_EMBED} (name, code),
      ${TRANSFER_ITEMS_EMBED} (
        id,
        item_id,
        variant_id,
        quantity_dispatched,
        quantity_accepted,
        quantity_damaged,
        quantity_lost,
        source_unit_cost_at_dispatch,
        items!stock_transfer_items_item_tenant_fk (name),
        item_variants!stock_transfer_items_variant_tenant_fk (sku)
      )
    `
    )
    .eq("tenant_id", tenantId)
    .eq("id", transferId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as TransferListDbRow & {
    transfer_lines: TransferLineDbRow[] | null;
  };

  const mapped = mapTransferListRow(row);
  const lines = (row.transfer_lines ?? []).map((line) => {
    const item = resolveJoin(line.items);
    const variant = resolveJoin(line.item_variants);
    return {
      id: line.id,
      item_id: line.item_id,
      item_name: item?.name ?? "",
      variant_id: line.variant_id,
      variant_sku: variant?.sku ?? "",
      quantity_dispatched: formatDecimal(line.quantity_dispatched),
      quantity_accepted: formatDecimal(line.quantity_accepted),
      quantity_damaged: formatDecimal(line.quantity_damaged),
      quantity_lost: formatDecimal(line.quantity_lost),
      source_unit_cost_at_dispatch: formatDecimal(line.source_unit_cost_at_dispatch),
    } satisfies TransferLineRow;
  });

  return { ...mapped, lines };
}
