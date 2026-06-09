import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PurchaseOrderLineRow,
  PurchaseOrderRow,
  PurchaseOrderStatus,
  ReceivablePurchaseOrderOption,
} from "@/lib/procurement/purchase-orders/types";

const DESTINATION_LOCATION_EMBED =
  "destination_location:tenant_locations!purchase_orders_location_tenant_fk";
const SUPPLIER_EMBED = "supplier:entities!purchase_orders_supplier_tenant_fk";
const PO_ITEMS_EMBED =
  "po_lines:purchase_order_items!purchase_order_items_po_tenant_fk";

type LocationEmbed = { name: string; code: string } | { name: string; code: string }[] | null;
type SupplierEmbed = { name: string } | { name: string }[] | null;

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

type PoListDbRow = {
  id: string;
  voucher_number: string;
  destination_location_id: string;
  supplier_id: string;
  document_status: string;
  currency_code: string;
  payment_terms_days: number | string | null;
  total_gross_amount: number | string | null;
  total_net_amount: number | string;
  custom_fields: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  destination_location: LocationEmbed;
  supplier: SupplierEmbed;
  po_lines: Array<{ id: string }> | null;
};

type PoLineDbRow = {
  id: string;
  item_id: string;
  variant_id: string;
  quantity_ordered: number | string;
  quantity_received: number | string;
  unit_price_contractual: number | string;
  line_total_gross: number | string;
  items: { name: string } | { name: string }[] | null;
  item_variants: { sku: string } | { sku: string }[] | null;
};

function mapPoLine(row: PoLineDbRow): PurchaseOrderLineRow {
  const item = resolveJoin(row.items);
  const variant = resolveJoin(row.item_variants);
  const ordered = formatDecimal(row.quantity_ordered);
  const received = formatDecimal(row.quantity_received);
  const openQty = Math.max(0, Number(ordered) - Number(received));

  return {
    id: row.id,
    item_id: row.item_id,
    item_name: item?.name ?? "",
    variant_id: row.variant_id,
    variant_sku: variant?.sku ?? "",
    quantity_ordered: ordered,
    quantity_received: received,
    unit_price_contractual: formatDecimal(row.unit_price_contractual),
    line_total_gross: formatDecimal(row.line_total_gross),
    open_quantity: String(openQty),
  };
}

function mapPoListRow(row: PoListDbRow): PurchaseOrderRow {
  const destination = resolveJoin(row.destination_location);
  const supplier = resolveJoin(row.supplier);

  return {
    id: row.id,
    voucher_number: row.voucher_number,
    destination_location_id: row.destination_location_id,
    destination_location_name: destination?.name ?? "",
    destination_location_code: destination?.code ?? "",
    supplier_id: row.supplier_id,
    supplier_name: supplier?.name ?? "",
    document_status: row.document_status as PurchaseOrderStatus,
    currency_code: row.currency_code ?? "USD",
    payment_terms_days: Number(row.payment_terms_days) || 0,
    total_gross_amount: formatDecimal(row.total_gross_amount),
    line_count: row.po_lines?.length ?? 0,
    total_net_amount: formatDecimal(row.total_net_amount),
    custom_fields: row.custom_fields ?? {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function fetchPurchaseOrders(
  supabase: SupabaseClient,
  tenantId: string,
  options?: { locationId?: string | null; status?: PurchaseOrderStatus | null }
): Promise<PurchaseOrderRow[]> {
  let query = supabase
    .from("purchase_orders")
    .select(
      `
      id,
      voucher_number,
      destination_location_id,
      supplier_id,
      document_status,
      currency_code,
      payment_terms_days,
      total_gross_amount,
      total_net_amount,
      custom_fields,
      created_at,
      updated_at,
      ${DESTINATION_LOCATION_EMBED} (name, code),
      ${SUPPLIER_EMBED} (name),
      ${PO_ITEMS_EMBED} (id)
    `
    )
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false });

  if (options?.locationId) {
    query = query.eq("destination_location_id", options.locationId);
  }

  if (options?.status) {
    query = query.eq("document_status", options.status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => mapPoListRow(row as PoListDbRow));
}

export async function fetchPurchaseOrderById(
  supabase: SupabaseClient,
  tenantId: string,
  purchaseOrderId: string
): Promise<PurchaseOrderRow | null> {
  const { data, error } = await supabase
    .from("purchase_orders")
    .select(
      `
      id,
      voucher_number,
      destination_location_id,
      supplier_id,
      document_status,
      currency_code,
      payment_terms_days,
      total_gross_amount,
      total_net_amount,
      custom_fields,
      created_at,
      updated_at,
      ${DESTINATION_LOCATION_EMBED} (name, code),
      ${SUPPLIER_EMBED} (name),
      ${PO_ITEMS_EMBED} (
        id,
        item_id,
        variant_id,
        quantity_ordered,
        quantity_received,
        unit_price_contractual,
        line_total_gross,
        items!purchase_order_items_item_tenant_fk (name),
        item_variants!purchase_order_items_variant_tenant_fk (sku)
      )
    `
    )
    .eq("tenant_id", tenantId)
    .eq("id", purchaseOrderId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as PoListDbRow & { po_lines?: PoLineDbRow[] | null };
  const mapped = mapPoListRow(row);
  mapped.lines = (row.po_lines ?? []).map(mapPoLine);
  return mapped;
}

export async function fetchReceivablePurchaseOrders(
  supabase: SupabaseClient,
  tenantId: string,
  options?: { locationId?: string | null }
): Promise<ReceivablePurchaseOrderOption[]> {
  let query = supabase
    .from("purchase_orders")
    .select(
      `
      id,
      voucher_number,
      destination_location_id,
      document_status,
      ${DESTINATION_LOCATION_EMBED} (name, code),
      ${SUPPLIER_EMBED} (name),
      ${PO_ITEMS_EMBED} (
        id,
        item_id,
        variant_id,
        quantity_ordered,
        quantity_received,
        unit_price_contractual,
        line_total_gross,
        items!purchase_order_items_item_tenant_fk (name),
        item_variants!purchase_order_items_variant_tenant_fk (sku)
      )
    `
    )
    .eq("tenant_id", tenantId)
    .in("document_status", ["ISSUED_ACTIVE", "PARTIALLY_FULFILLED"])
    .order("voucher_number");

  if (options?.locationId) {
    query = query.eq("destination_location_id", options.locationId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  type ReceivablePoDbRow = {
    id: string;
    voucher_number: string;
    destination_location_id: string;
    destination_location: LocationEmbed;
    supplier: SupplierEmbed;
    po_lines?: PoLineDbRow[] | null;
  };

  return (data ?? [])
    .map((row) => {
      const typed = row as ReceivablePoDbRow;
      const destination = resolveJoin(typed.destination_location);
      const supplier = resolveJoin(typed.supplier);
      const lines = (typed.po_lines ?? []).map(mapPoLine);
      const openLines = lines.filter((line) => Number(line.open_quantity) > 0);
      if (openLines.length === 0) return null;

      return {
        id: typed.id,
        voucher_number: typed.voucher_number,
        destination_location_id: typed.destination_location_id,
        destination_location_name: destination?.name ?? "",
        destination_location_code: destination?.code ?? "",
        supplier_name: supplier?.name ?? "",
        lines: openLines,
      } satisfies ReceivablePurchaseOrderOption;
    })
    .filter((row): row is ReceivablePurchaseOrderOption => row !== null);
}
