import type { SupabaseClient } from "@supabase/supabase-js";
import type { GrnShipmentReceiptContext } from "@/lib/procurement/import-logistics/receipt-context";
import type {
  AllocatableImportPurchaseOrderOption,
  ImportShipmentLineRow,
  ImportShipmentRow,
  ImportShipmentStatus,
} from "@/lib/procurement/shipments/types";

type RawShipmentRow = {
  id: string;
  shipment_number: string;
  status: string;
  supplier_id: string | null;
  forwarder_entity_id: string | null;
  staging_location_id: string | null;
  ultimate_destination_location_id: string | null;
  incoterms_code: string | null;
  bill_of_lading: string | null;
  container_numbers: unknown;
  awb: string | null;
  vessel_name: string | null;
  port_of_loading: string | null;
  port_of_discharge: string | null;
  etd: string | null;
  eta: string | null;
  bill_of_entry_number: string | null;
  bill_of_entry_date: string | null;
  port_code: string | null;
  exchange_rate: number | string | null;
  assessable_value: number | string | null;
  customs_duty_amount: number | string | null;
  import_igst_amount: number | string | null;
  notes: string | null;
  created_at: string;
  issued_at: string | null;
};

export type ReceivableImportShipmentOption = GrnShipmentReceiptContext & {
  shipment_number: string;
  status: string;
  purchase_order_ids: string[];
};

function formatDecimal(value: number | string | null | undefined): string {
  if (value == null || value === "") return "0";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : "0";
}

function formatNullableDecimal(value: number | string | null | undefined): string | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : null;
}

function parseContainerNumbers(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry).trim()).filter(Boolean);
}

function mapShipmentContext(row: RawShipmentRow): GrnShipmentReceiptContext {
  return {
    id: row.id,
    staging_location_id: row.staging_location_id,
    ultimate_destination_location_id: row.ultimate_destination_location_id,
    bill_of_entry_number: row.bill_of_entry_number,
    bill_of_entry_date: row.bill_of_entry_date,
    port_code: row.port_code,
    exchange_rate: formatNullableDecimal(row.exchange_rate),
    assessable_value: formatNullableDecimal(row.assessable_value),
    customs_duty_amount: formatNullableDecimal(row.customs_duty_amount),
    import_igst_amount: formatNullableDecimal(row.import_igst_amount),
  };
}

const SHIPMENT_LIST_SELECT = `
  id, shipment_number, status, supplier_id, forwarder_entity_id,
  staging_location_id, ultimate_destination_location_id,
  incoterms_code, bill_of_lading, container_numbers, awb, vessel_name,
  port_of_loading, port_of_discharge, etd, eta,
  bill_of_entry_number, bill_of_entry_date, port_code,
  exchange_rate, assessable_value, customs_duty_amount, import_igst_amount,
  notes, created_at, issued_at
`;

async function fetchEntityNameMap(
  supabase: SupabaseClient,
  tenantId: string,
  entityIds: string[]
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(entityIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const { data } = await supabase
    .from("entities")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .in("id", uniqueIds);

  return new Map((data ?? []).map((row) => [String(row.id), String(row.name)]));
}

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

async function fetchPoNumbersByShipment(
  supabase: SupabaseClient,
  tenantId: string,
  shipmentIds: string[]
): Promise<Map<string, string[]>> {
  const uniqueIds = [...new Set(shipmentIds.filter(Boolean))];
  const result = new Map<string, string[]>();
  if (uniqueIds.length === 0) return result;

  const { data: linkRows } = await supabase
    .from("import_shipment_purchase_orders")
    .select("shipment_id, purchase_order_id")
    .eq("tenant_id", tenantId)
    .in("shipment_id", uniqueIds);

  const poIds = [...new Set((linkRows ?? []).map((row) => String(row.purchase_order_id)))];
  if (poIds.length === 0) return result;

  const { data: poRows } = await supabase
    .from("purchase_orders")
    .select("id, voucher_number")
    .eq("tenant_id", tenantId)
    .in("id", poIds);

  const poNumbers = new Map((poRows ?? []).map((row) => [String(row.id), String(row.voucher_number)]));

  for (const row of linkRows ?? []) {
    const shipmentId = String(row.shipment_id);
    const voucherNumber = poNumbers.get(String(row.purchase_order_id));
    if (!voucherNumber) continue;
    const current = result.get(shipmentId) ?? [];
    current.push(voucherNumber);
    result.set(shipmentId, current);
  }

  return result;
}

async function enrichShipmentRows(
  supabase: SupabaseClient,
  tenantId: string,
  rows: RawShipmentRow[],
  lineCounts: Map<string, number>
): Promise<ImportShipmentRow[]> {
  const entityIds = rows.flatMap((row) => [row.supplier_id ?? "", row.forwarder_entity_id ?? ""]);
  const locationIds = rows.flatMap((row) => [
    row.staging_location_id ?? "",
    row.ultimate_destination_location_id ?? "",
  ]);
  const shipmentIds = rows.map((row) => row.id);

  const [entityNames, locationNames, poNumbersByShipment] = await Promise.all([
    fetchEntityNameMap(supabase, tenantId, entityIds),
    fetchLocationNameMap(supabase, tenantId, locationIds),
    fetchPoNumbersByShipment(supabase, tenantId, shipmentIds),
  ]);

  return rows.map((row) => ({
    id: row.id,
    shipment_number: row.shipment_number,
    status: row.status as ImportShipmentStatus,
    supplier_id: row.supplier_id,
    supplier_name: row.supplier_id ? entityNames.get(row.supplier_id) ?? "" : "",
    forwarder_entity_id: row.forwarder_entity_id,
    forwarder_name: row.forwarder_entity_id ? entityNames.get(row.forwarder_entity_id) ?? null : null,
    staging_location_id: row.staging_location_id,
    staging_location_name: row.staging_location_id
      ? locationNames.get(row.staging_location_id) ?? null
      : null,
    ultimate_destination_location_id: row.ultimate_destination_location_id,
    ultimate_destination_location_name: row.ultimate_destination_location_id
      ? locationNames.get(row.ultimate_destination_location_id) ?? null
      : null,
    incoterms_code: row.incoterms_code,
    bill_of_lading: row.bill_of_lading,
    container_numbers: parseContainerNumbers(row.container_numbers),
    awb: row.awb,
    vessel_name: row.vessel_name,
    port_of_loading: row.port_of_loading,
    port_of_discharge: row.port_of_discharge,
    etd: row.etd,
    eta: row.eta,
    bill_of_entry_number: row.bill_of_entry_number,
    bill_of_entry_date: row.bill_of_entry_date,
    port_code: row.port_code,
    exchange_rate: formatDecimal(row.exchange_rate),
    assessable_value: formatDecimal(row.assessable_value),
    customs_duty_amount: formatDecimal(row.customs_duty_amount),
    import_igst_amount: formatDecimal(row.import_igst_amount),
    notes: row.notes,
    line_count: lineCounts.get(row.id) ?? 0,
    purchase_order_numbers: poNumbersByShipment.get(row.id) ?? [],
    created_at: row.created_at,
    issued_at: row.issued_at,
  }));
}

export async function fetchReceivableImportShipments(
  supabase: SupabaseClient,
  tenantId: string,
  options?: { purchaseOrderId?: string | null }
): Promise<ReceivableImportShipmentOption[]> {
  const { data, error } = await supabase
    .from("import_shipments")
    .select(
      "id, shipment_number, status, staging_location_id, ultimate_destination_location_id, bill_of_entry_number, bill_of_entry_date, port_code, exchange_rate, assessable_value, customs_duty_amount, import_igst_amount"
    )
    .eq("tenant_id", tenantId)
    .in("status", ["BOOKED", "IN_TRANSIT", "AT_STAGING", "CUSTOMS_PENDING", "CLEARED"])
    .order("shipment_number");

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as RawShipmentRow[];
  if (rows.length === 0) return [];

  const shipmentIds = rows.map((row) => row.id);
  const { data: links } = await supabase
    .from("import_shipment_purchase_orders")
    .select("shipment_id, purchase_order_id")
    .eq("tenant_id", tenantId)
    .in("shipment_id", shipmentIds);

  const poIdsByShipment = new Map<string, string[]>();
  for (const link of links ?? []) {
    const shipmentId = String(link.shipment_id);
    const list = poIdsByShipment.get(shipmentId) ?? [];
    list.push(String(link.purchase_order_id));
    poIdsByShipment.set(shipmentId, list);
  }

  return rows
    .map((row) => {
      const purchase_order_ids = poIdsByShipment.get(row.id) ?? [];
      if (options?.purchaseOrderId && !purchase_order_ids.includes(options.purchaseOrderId)) {
        return null;
      }
      return {
        ...mapShipmentContext(row),
        shipment_number: row.shipment_number,
        status: row.status,
        purchase_order_ids,
      } satisfies ReceivableImportShipmentOption;
    })
    .filter((row): row is ReceivableImportShipmentOption => row !== null);
}

export async function fetchImportShipmentContextById(
  supabase: SupabaseClient,
  tenantId: string,
  shipmentId: string
): Promise<GrnShipmentReceiptContext | null> {
  const { data, error } = await supabase
    .from("import_shipments")
    .select(
      "id, staging_location_id, ultimate_destination_location_id, bill_of_entry_number, bill_of_entry_date, port_code, exchange_rate, assessable_value, customs_duty_amount, import_igst_amount"
    )
    .eq("tenant_id", tenantId)
    .eq("id", shipmentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapShipmentContext(data as RawShipmentRow);
}

export async function fetchImportShipments(
  supabase: SupabaseClient,
  tenantId: string,
  options?: { status?: ImportShipmentStatus }
): Promise<ImportShipmentRow[]> {
  let query = supabase
    .from("import_shipments")
    .select(SHIPMENT_LIST_SELECT)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (options?.status) query = query.eq("status", options.status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as RawShipmentRow[];
  const shipmentIds = rows.map((row) => row.id);
  const lineCounts = new Map<string, number>();

  if (shipmentIds.length > 0) {
    const { data: lineRows } = await supabase
      .from("import_shipment_lines")
      .select("shipment_id")
      .eq("tenant_id", tenantId)
      .in("shipment_id", shipmentIds);

    for (const line of lineRows ?? []) {
      const shipmentId = String(line.shipment_id);
      lineCounts.set(shipmentId, (lineCounts.get(shipmentId) ?? 0) + 1);
    }
  }

  return enrichShipmentRows(supabase, tenantId, rows, lineCounts);
}

export async function fetchImportShipmentById(
  supabase: SupabaseClient,
  tenantId: string,
  shipmentId: string
): Promise<ImportShipmentRow | null> {
  const { data, error } = await supabase
    .from("import_shipments")
    .select(SHIPMENT_LIST_SELECT)
    .eq("tenant_id", tenantId)
    .eq("id", shipmentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as RawShipmentRow;
  const lineCounts = new Map<string, number>([[row.id, 0]]);

  const { count } = await supabase
    .from("import_shipment_lines")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("shipment_id", shipmentId);

  lineCounts.set(row.id, count ?? 0);

  const [enriched] = await enrichShipmentRows(supabase, tenantId, [row], lineCounts);
  return enriched ?? null;
}

export async function fetchImportShipmentLines(
  supabase: SupabaseClient,
  tenantId: string,
  shipmentId: string
): Promise<ImportShipmentLineRow[]> {
  const { data, error } = await supabase
    .from("import_shipment_lines")
    .select(
      "id, purchase_order_id, po_item_id, variant_id, item_id, quantity_shipped, quantity_received_staging, quantity_in_git, quantity_cleared"
    )
    .eq("tenant_id", tenantId)
    .eq("shipment_id", shipmentId)
    .order("created_at");

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const poIds = [...new Set(rows.map((row) => String(row.purchase_order_id)))];
  const itemIds = [...new Set(rows.map((row) => String(row.item_id)))];
  const variantIds = [...new Set(rows.map((row) => String(row.variant_id)))];

  const [{ data: poRows }, { data: itemRows }, { data: variantRows }] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select("id, voucher_number")
      .eq("tenant_id", tenantId)
      .in("id", poIds),
    supabase.from("items").select("id, name").eq("tenant_id", tenantId).in("id", itemIds),
    supabase.from("item_variants").select("id, sku").eq("tenant_id", tenantId).in("id", variantIds),
  ]);

  const poNumbers = new Map((poRows ?? []).map((row) => [String(row.id), String(row.voucher_number)]));
  const itemNames = new Map((itemRows ?? []).map((row) => [String(row.id), String(row.name)]));
  const variantSkus = new Map((variantRows ?? []).map((row) => [String(row.id), String(row.sku)]));

  return rows.map((row) => ({
    id: String(row.id),
    purchase_order_id: String(row.purchase_order_id),
    purchase_order_number: poNumbers.get(String(row.purchase_order_id)) ?? "",
    po_item_id: String(row.po_item_id),
    variant_id: String(row.variant_id),
    item_id: String(row.item_id),
    item_name: itemNames.get(String(row.item_id)) ?? "",
    variant_sku: variantSkus.get(String(row.variant_id)) ?? "",
    quantity_shipped: formatDecimal(row.quantity_shipped),
    quantity_received_staging: formatDecimal(row.quantity_received_staging),
    quantity_in_git: formatDecimal(row.quantity_in_git),
    quantity_cleared: formatDecimal(row.quantity_cleared),
  }));
}

export async function fetchAllocatableImportPurchaseOrders(
  supabase: SupabaseClient,
  tenantId: string
): Promise<AllocatableImportPurchaseOrderOption[]> {
  const { data, error } = await supabase
    .from("purchase_orders")
    .select(
      `
      id,
      voucher_number,
      supplier_id,
      destination_location_id,
      receipt_location_id,
      ultimate_destination_location_id,
      supplier:entities!purchase_orders_supplier_tenant_fk (name),
      destination_location:tenant_locations!purchase_orders_location_tenant_fk (name),
      po_lines:purchase_order_items!purchase_order_items_po_tenant_fk (
        id,
        item_id,
        variant_id,
        quantity_ordered,
        quantity_received,
        unit_price_contractual,
        is_promotional,
        items!purchase_order_items_item_tenant_fk (name),
        item_variants!purchase_order_items_variant_tenant_fk (sku)
      )
    `
    )
    .eq("tenant_id", tenantId)
    .eq("tax_supply_nature", "IMPORT_GOODS")
    .in("document_status", ["ISSUED_ACTIVE", "PARTIALLY_FULFILLED"])
    .order("voucher_number");

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row) => {
      const supplier = row.supplier as { name?: string } | null;
      const destination = row.destination_location as { name?: string } | null;
      const lines = (row.po_lines ?? [])
        .map((line) => {
          const item = line.items as { name?: string } | null;
          const variant = line.item_variants as { sku?: string } | null;
          const ordered = Number(line.quantity_ordered) || 0;
          const received = Number(line.quantity_received) || 0;
          const open = Math.max(ordered - received, 0);
          if (open <= 0 || line.is_promotional) return null;
          return {
            id: String(line.id),
            variant_id: String(line.variant_id),
            item_id: String(line.item_id),
            item_name: item?.name ?? "",
            variant_sku: variant?.sku ?? "",
            open_quantity: String(open),
            unit_price_contractual: formatDecimal(line.unit_price_contractual),
            is_promotional: Boolean(line.is_promotional),
          };
        })
        .filter((line): line is NonNullable<typeof line> => line !== null);

      if (lines.length === 0) return null;

      return {
        id: String(row.id),
        voucher_number: String(row.voucher_number),
        supplier_id: String(row.supplier_id),
        supplier_name: supplier?.name ?? "",
        destination_location_id: String(row.destination_location_id),
        destination_location_name: destination?.name ?? "",
        receipt_location_id: (row.receipt_location_id as string | null) ?? null,
        ultimate_destination_location_id:
          (row.ultimate_destination_location_id as string | null) ?? null,
        lines,
      } satisfies AllocatableImportPurchaseOrderOption;
    })
    .filter((row): row is AllocatableImportPurchaseOrderOption => row !== null);
}
