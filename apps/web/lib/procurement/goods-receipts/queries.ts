import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchLatestDocumentPostingRun } from "@/lib/documents/posting-queries";
import type { GoodsReceiptLineRow, GoodsReceiptRow } from "@/lib/procurement/goods-receipts/types";

const DESTINATION_LOCATION_EMBED =
  "destination_location:tenant_locations!goods_receipts_location_tenant_fk";
const PO_EMBED = "purchase_order:purchase_orders!goods_receipts_po_tenant_fk";
const GRN_ITEMS_EMBED =
  "grn_lines:goods_receipt_items!goods_receipt_items_gr_tenant_fk";

type LocationEmbed = { name: string; code: string } | { name: string; code: string }[] | null;
type PoEmbed =
  | { voucher_number: string }
  | { voucher_number: string }[]
  | null;

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

type GrnListDbRow = {
  id: string;
  voucher_number: string;
  destination_location_id: string;
  purchase_order_id: string | null;
  is_qc_pending: boolean;
  received_at: string;
  created_at: string;
  destination_location: LocationEmbed;
  purchase_order: PoEmbed;
  grn_lines: Array<{ id: string }> | null;
};

type GrnLineDbRow = {
  id: string;
  item_id: string;
  variant_id: string;
  po_item_id: string | null;
  quantity_received: number | string;
  quantity_accepted: number | string;
  quantity_rejected: number | string;
  raw_unit_cost: number | string;
  total_final_landed_cost: number | string;
  items: { name: string } | { name: string }[] | null;
  item_variants: { sku: string } | { sku: string }[] | null;
};

function mapGrnLine(row: GrnLineDbRow): GoodsReceiptLineRow {
  const item = resolveJoin(row.items);
  const variant = resolveJoin(row.item_variants);

  return {
    id: row.id,
    item_id: row.item_id,
    item_name: item?.name ?? "",
    variant_id: row.variant_id,
    variant_sku: variant?.sku ?? "",
    po_item_id: row.po_item_id,
    quantity_received: formatDecimal(row.quantity_received),
    quantity_accepted: formatDecimal(row.quantity_accepted),
    quantity_rejected: formatDecimal(row.quantity_rejected),
    raw_unit_cost: formatDecimal(row.raw_unit_cost),
    total_final_landed_cost: formatDecimal(row.total_final_landed_cost),
  };
}

function mapGrnListRow(row: GrnListDbRow): GoodsReceiptRow {
  const destination = resolveJoin(row.destination_location);
  const po = resolveJoin(row.purchase_order);

  return {
    id: row.id,
    voucher_number: row.voucher_number,
    destination_location_id: row.destination_location_id,
    destination_location_name: destination?.name ?? "",
    destination_location_code: destination?.code ?? "",
    purchase_order_id: row.purchase_order_id,
    purchase_order_number: po?.voucher_number ?? null,
    is_qc_pending: row.is_qc_pending,
    line_count: row.grn_lines?.length ?? 0,
    received_at: row.received_at,
    created_at: row.created_at,
  };
}

export async function fetchGoodsReceipts(
  supabase: SupabaseClient,
  tenantId: string,
  options?: { locationId?: string | null }
): Promise<GoodsReceiptRow[]> {
  let query = supabase
    .from("goods_receipts")
    .select(
      `
      id,
      voucher_number,
      destination_location_id,
      purchase_order_id,
      is_qc_pending,
      received_at,
      created_at,
      ${DESTINATION_LOCATION_EMBED} (name, code),
      ${PO_EMBED} (voucher_number),
      ${GRN_ITEMS_EMBED} (id)
    `
    )
    .eq("tenant_id", tenantId)
    .order("received_at", { ascending: false });

  if (options?.locationId) {
    query = query.eq("destination_location_id", options.locationId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => mapGrnListRow(row as GrnListDbRow));
}

export async function fetchGoodsReceiptById(
  supabase: SupabaseClient,
  tenantId: string,
  goodsReceiptId: string
): Promise<GoodsReceiptRow | null> {
  const { data, error } = await supabase
    .from("goods_receipts")
    .select(
      `
      id,
      voucher_number,
      destination_location_id,
      purchase_order_id,
      is_qc_pending,
      received_at,
      created_at,
      ${DESTINATION_LOCATION_EMBED} (name, code),
      ${PO_EMBED} (voucher_number),
      ${GRN_ITEMS_EMBED} (
        id,
        item_id,
        variant_id,
        po_item_id,
        quantity_received,
        quantity_accepted,
        quantity_rejected,
        raw_unit_cost,
        total_final_landed_cost,
        items!goods_receipt_items_item_tenant_fk (name),
        item_variants!goods_receipt_items_variant_tenant_fk (sku)
      )
    `
    )
    .eq("tenant_id", tenantId)
    .eq("id", goodsReceiptId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as GrnListDbRow & { grn_lines?: GrnLineDbRow[] | null };
  const mapped = mapGrnListRow(row);
  mapped.lines = (row.grn_lines ?? []).map(mapGrnLine);

  const postingRun = await fetchLatestDocumentPostingRun(supabase, "GRN", goodsReceiptId);
  if (postingRun) {
    mapped.posting_steps = postingRun.steps;
    mapped.posting_at = postingRun.posted_at;
  }

  return mapped;
}
