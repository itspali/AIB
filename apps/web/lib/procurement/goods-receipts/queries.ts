import type { SupabaseClient } from "@supabase/supabase-js";
import type { GoodsReceiptLineRow, GoodsReceiptRow } from "@/lib/procurement/goods-receipts/types";
import {
  fetchAllSupabaseRows,
  SUPABASE_MAX_ROWS_PER_PAGE,
} from "@/lib/supabase/fetch-all-rows";

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
  bill_of_entry_number: string | null;
  bill_of_entry_date: string | null;
  port_code: string | null;
  exchange_rate: number | string | null;
  assessable_value: number | string | null;
  customs_duty_amount: number | string | null;
  import_igst_amount: number | string | null;
  destination_location: LocationEmbed;
  purchase_order: PoEmbed;
  grn_lines?: Array<{ id: string }> | null;
};

type GrnLineDbRow = {
  id: string;
  item_id: string;
  variant_id: string;
  po_item_id: string | null;
  quantity_received: number | string;
  quantity_accepted: number | string;
  quantity_rejected: number | string;
  route_to_qc?: boolean | null;
  is_promotional?: boolean | null;
  raw_unit_cost: number | string;
  total_final_landed_cost: number | string;
  import_igst_amount: number | string | null;
  customs_duty_amount: number | string | null;
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
    route_to_qc: row.route_to_qc === true,
    is_promotional:
      row.is_promotional === true ||
      (Number(formatDecimal(row.raw_unit_cost)) === 0 && row.po_item_id != null),
    raw_unit_cost: formatDecimal(row.raw_unit_cost),
    total_final_landed_cost: formatDecimal(row.total_final_landed_cost),
    import_igst_amount: formatDecimal(row.import_igst_amount),
    customs_duty_amount: formatDecimal(row.customs_duty_amount),
  };
}

function mapGrnListRow(row: GrnListDbRow, lineCount?: number): GoodsReceiptRow {
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
    line_count: lineCount ?? row.grn_lines?.length ?? 0,
    received_at: row.received_at,
    created_at: row.created_at,
    bill_of_entry_number: row.bill_of_entry_number ?? null,
    bill_of_entry_date: row.bill_of_entry_date ?? null,
    port_code: row.port_code ?? null,
    exchange_rate: row.exchange_rate != null ? formatDecimal(row.exchange_rate) : null,
    assessable_value: row.assessable_value != null ? formatDecimal(row.assessable_value) : null,
    customs_duty_amount:
      row.customs_duty_amount != null ? formatDecimal(row.customs_duty_amount) : null,
    import_igst_amount:
      row.import_igst_amount != null ? formatDecimal(row.import_igst_amount) : null,
  };
}

const GRN_LIST_HEADER_SELECT = `
      id,
      voucher_number,
      destination_location_id,
      purchase_order_id,
      is_qc_pending,
      received_at,
      created_at,
      bill_of_entry_number,
      bill_of_entry_date,
      port_code,
      exchange_rate,
      assessable_value,
      customs_duty_amount,
      import_igst_amount,
      ${DESTINATION_LOCATION_EMBED} (name, code),
      ${PO_EMBED} (voucher_number)
    `;

function chunkIds<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function hydrateGrnLineCounts(
  supabase: SupabaseClient,
  tenantId: string,
  goodsReceiptIds: readonly string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const uniqueIds = [...new Set(goodsReceiptIds.filter(Boolean))];
  if (!uniqueIds.length) return counts;

  for (const idChunk of chunkIds(uniqueIds, SUPABASE_MAX_ROWS_PER_PAGE)) {
    const lineRows = await fetchAllSupabaseRows<{ goods_receipt_id: string }>(async (from, to) =>
      supabase
        .from("goods_receipt_items")
        .select("goods_receipt_id")
        .eq("tenant_id", tenantId)
        .in("goods_receipt_id", idChunk)
        .range(from, to)
    );

    for (const row of lineRows) {
      const goodsReceiptId = row.goods_receipt_id;
      counts.set(goodsReceiptId, (counts.get(goodsReceiptId) ?? 0) + 1);
    }
  }

  return counts;
}

export async function fetchGoodsReceipts(
  supabase: SupabaseClient,
  tenantId: string,
  options?: { locationId?: string | null }
): Promise<GoodsReceiptRow[]> {
  const rows = await fetchAllSupabaseRows<GrnListDbRow>(async (from, to) => {
    let query = supabase
      .from("goods_receipts")
      .select(GRN_LIST_HEADER_SELECT)
      .eq("tenant_id", tenantId)
      .order("received_at", { ascending: false })
      .range(from, to);

    if (options?.locationId) {
      query = query.eq("destination_location_id", options.locationId);
    }

    return query as unknown as Promise<{
      data: GrnListDbRow[] | null;
      error: import("@supabase/supabase-js").PostgrestError | null;
    }>;
  });

  const lineCounts = await hydrateGrnLineCounts(
    supabase,
    tenantId,
    rows.map((row) => row.id)
  );

  return rows.map((row) => mapGrnListRow(row, lineCounts.get(row.id) ?? 0));
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
      bill_of_entry_number,
      bill_of_entry_date,
      port_code,
      exchange_rate,
      assessable_value,
      customs_duty_amount,
      import_igst_amount,
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
        route_to_qc,
        is_promotional,
        raw_unit_cost,
        total_final_landed_cost,
        import_igst_amount,
        customs_duty_amount,
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

  if (mapped.is_qc_pending && mapped.lines.length > 0) {
    mapped.lines = await hydrateGrnLineQcHoldQuantities(
      supabase,
      tenantId,
      goodsReceiptId,
      mapped.lines
    );
  }


  return mapped;
}

async function hydrateGrnLineQcHoldQuantities(
  supabase: SupabaseClient,
  tenantId: string,
  goodsReceiptId: string,
  lines: GoodsReceiptLineRow[]
): Promise<GoodsReceiptLineRow[]> {
  const { data, error } = await supabase
    .from("qc_inventory_balances")
    .select("goods_receipt_item_id, quantity_on_hand")
    .eq("tenant_id", tenantId)
    .eq("goods_receipt_id", goodsReceiptId);

  if (error) return lines;
  if (!data?.length) return lines;

  const holdByLineId = new Map(
    data.map(
      (row) =>
        [
          row.goods_receipt_item_id as string,
          formatDecimal(row.quantity_on_hand),
        ] as const
    )
  );

  return lines.map((line) => {
    const hold = holdByLineId.get(line.id);
    if (hold == null) return line;
    return { ...line, quantity_on_qc_hold: hold };
  });
}

const GRN_PO_DETAIL_SELECT = `
      id,
      voucher_number,
      destination_location_id,
      purchase_order_id,
      is_qc_pending,
      received_at,
      created_at,
      bill_of_entry_number,
      bill_of_entry_date,
      port_code,
      exchange_rate,
      assessable_value,
      customs_duty_amount,
      import_igst_amount,
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
        route_to_qc,
        is_promotional,
        raw_unit_cost,
        total_final_landed_cost,
        import_igst_amount,
        customs_duty_amount,
        items!goods_receipt_items_item_tenant_fk (name),
        item_variants!goods_receipt_items_variant_tenant_fk (sku)
      )
    `;

async function resolveMappedGoodsReceiptIdsForPurchaseOrder(
  supabase: SupabaseClient,
  tenantId: string,
  purchaseOrderId: string
): Promise<string[]> {
  const mappingRows = await fetchAllSupabaseRows<{ goods_receipt_id: string }>(async (from, to) =>
    supabase
      .from("purchase_order_grn_mappings")
      .select("goods_receipt_id")
      .eq("tenant_id", tenantId)
      .eq("purchase_order_id", purchaseOrderId)
      .range(from, to)
  );

  return [...new Set(mappingRows.map((row) => row.goods_receipt_id))];
}

export async function fetchGoodsReceiptsForPurchaseOrder(
  supabase: SupabaseClient,
  tenantId: string,
  purchaseOrderId: string
): Promise<GoodsReceiptRow[]> {
  const mappedIds = await resolveMappedGoodsReceiptIdsForPurchaseOrder(
    supabase,
    tenantId,
    purchaseOrderId
  );

  const rows = await fetchAllSupabaseRows<GrnListDbRow & { grn_lines?: GrnLineDbRow[] | null }>(
    async (from, to) => {
      let query = supabase
        .from("goods_receipts")
        .select(GRN_PO_DETAIL_SELECT)
        .eq("tenant_id", tenantId)
        .order("received_at", { ascending: false })
        .range(from, to);

      if (mappedIds.length > 0) {
        query = query.or(
          `purchase_order_id.eq.${purchaseOrderId},id.in.(${mappedIds.join(",")})`
        );
      } else {
        query = query.eq("purchase_order_id", purchaseOrderId);
      }

      return query;
    }
  );

  return rows.map((row) => {
    const mapped = mapGrnListRow(row);
    mapped.lines = (row.grn_lines ?? []).map(mapGrnLine);
    return mapped;
  });
}
