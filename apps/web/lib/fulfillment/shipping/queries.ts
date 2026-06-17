import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  SalesShipmentLineRow,
  SalesShipmentRow,
  ShippableSalesOrder,
  ShippableSalesOrderLine,
  ShippingCarrierProvider,
} from "@/lib/fulfillment/shipping/types";

const SHIPMENT_ORDER_EMBED = "sales_orders!sales_shipments_order_tenant_fk";
const SHIPMENT_LOCATION_EMBED =
  "tenant_locations!sales_shipments_origin_location_tenant_fk";
const SHIPMENT_PACKAGES_EMBED =
  "packages:sales_shipment_packages!sales_shipment_packages_shipment_tenant_fk";
const SHIPMENT_PACKAGE_ITEMS_EMBED =
  "package_items:sales_shipment_items!sales_shipment_items_package_tenant_fk";
const SHIPMENT_ITEM_ORDER_LINE_EMBED =
  "sales_order_items!sales_shipment_items_order_item_tenant_fk";

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

type ShipmentListDbRow = {
  id: string;
  sales_order_id: string;
  origin_location_id: string;
  carrier_provider: string;
  tracking_number: string;
  dispatched_at: string;
  delivered_at: string | null;
  sales_orders:
    | {
        voucher_number: string;
        customer: { name: string } | { name: string }[] | null;
      }
    | {
        voucher_number: string;
        customer: { name: string } | { name: string }[] | null;
      }[]
    | null;
  tenant_locations: { name: string; code: string } | { name: string; code: string }[] | null;
  packages: Array<{
    package_items: Array<{ id: string }> | null;
  }> | null;
};

type ShipmentDetailDbRow = ShipmentListDbRow & {
  packages: Array<{
    package_items: Array<{
      id: string;
      quantity_shipped: number | string;
      sales_order_item_id: string;
      sales_order_items:
        | {
            quantity_ordered: number | string;
            items: { name: string } | { name: string }[] | null;
            item_variants: { sku: string } | { sku: string }[] | null;
          }
        | {
            quantity_ordered: number | string;
            items: { name: string } | { name: string }[] | null;
            item_variants: { sku: string } | { sku: string }[] | null;
          }[]
        | null;
    }> | null;
  }> | null;
};

function mapShipmentListRow(row: ShipmentListDbRow): SalesShipmentRow {
  const order = resolveJoin(row.sales_orders);
  const customer = resolveJoin(order?.customer ?? null);
  const location = resolveJoin(row.tenant_locations);
  const lineCount =
    row.packages?.reduce((sum, pkg) => sum + (pkg.package_items?.length ?? 0), 0) ?? 0;

  return {
    id: row.id,
    sales_order_id: row.sales_order_id,
    sales_order_voucher: order?.voucher_number ?? "",
    customer_name: customer?.name ?? "",
    origin_location_id: row.origin_location_id,
    origin_location_name: location?.name ?? "",
    origin_location_code: location?.code ?? "",
    carrier_provider: row.carrier_provider as ShippingCarrierProvider,
    tracking_number: row.tracking_number,
    dispatched_at: row.dispatched_at,
    delivered_at: row.delivered_at,
    line_count: lineCount,
  };
}

export async function fetchSalesShipments(
  supabase: SupabaseClient,
  tenantId: string
): Promise<SalesShipmentRow[]> {
  const { data, error } = await supabase
    .from("sales_shipments")
    .select(
      `
      id,
      sales_order_id,
      origin_location_id,
      carrier_provider,
      tracking_number,
      dispatched_at,
      delivered_at,
      ${SHIPMENT_ORDER_EMBED} (
        voucher_number,
        customer:entities!sales_orders_customer_tenant_fk (name)
      ),
      ${SHIPMENT_LOCATION_EMBED} (name, code),
      ${SHIPMENT_PACKAGES_EMBED} (
        ${SHIPMENT_PACKAGE_ITEMS_EMBED} (id)
      )
    `
    )
    .eq("tenant_id", tenantId)
    .order("dispatched_at", { ascending: false });

  if (error) throw new Error(error.message);

  return ((data ?? []) as ShipmentListDbRow[]).map(mapShipmentListRow);
}

export async function fetchSalesShipmentById(
  supabase: SupabaseClient,
  tenantId: string,
  shipmentId: string
): Promise<SalesShipmentRow | null> {
  const { data, error } = await supabase
    .from("sales_shipments")
    .select(
      `
      id,
      sales_order_id,
      origin_location_id,
      carrier_provider,
      tracking_number,
      dispatched_at,
      delivered_at,
      ${SHIPMENT_ORDER_EMBED} (
        voucher_number,
        customer:entities!sales_orders_customer_tenant_fk (name)
      ),
      ${SHIPMENT_LOCATION_EMBED} (name, code),
      ${SHIPMENT_PACKAGES_EMBED} (
        ${SHIPMENT_PACKAGE_ITEMS_EMBED} (
          id,
          quantity_shipped,
          sales_order_item_id,
          ${SHIPMENT_ITEM_ORDER_LINE_EMBED} (
            quantity_ordered,
            items (name),
            item_variants (sku)
          )
        )
      )
    `
    )
    .eq("tenant_id", tenantId)
    .eq("id", shipmentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as ShipmentDetailDbRow;
  const base = mapShipmentListRow(row);
  const lines: SalesShipmentLineRow[] = [];

  for (const pkg of row.packages ?? []) {
    for (const item of pkg.package_items ?? []) {
      const soLine = resolveJoin(item.sales_order_items);
      const itemEmbed = resolveJoin(soLine?.items ?? null);
      const variant = resolveJoin(soLine?.item_variants ?? null);
      const ordered = formatDecimal(soLine?.quantity_ordered ?? 0);
      const shipped = formatDecimal(item.quantity_shipped);
      lines.push({
        id: item.id,
        sales_order_item_id: item.sales_order_item_id,
        item_name: itemEmbed?.name ?? "",
        variant_sku: variant?.sku ?? "",
        quantity_shipped: shipped,
        quantity_ordered: ordered,
        quantity_open: String(Math.max(0, Number(ordered) - Number(shipped))),
      });
    }
  }

  return { ...base, lines };
}

export async function fetchShippableSalesOrder(
  supabase: SupabaseClient,
  tenantId: string,
  salesOrderId: string
): Promise<ShippableSalesOrder | null> {
  const { data, error } = await supabase
    .from("sales_orders")
    .select(
      `
      id,
      voucher_number,
      commercial_status,
      shipping_location_id,
      shipping_location:tenant_locations!sales_orders_shipping_location_tenant_fk (name),
      customer:entities!sales_orders_customer_tenant_fk (name),
      so_lines:sales_order_items!sales_order_items_order_tenant_fk (
        id,
        quantity_ordered,
        quantity_allocated,
        quantity_shipped,
        items (name),
        item_variants (sku)
      )
    `
    )
    .eq("tenant_id", tenantId)
    .eq("id", salesOrderId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const shippingLocation = resolveJoin(
    (data as { shipping_location: { name: string } | { name: string }[] | null }).shipping_location
  );
  const customer = resolveJoin(
    (data as { customer: { name: string } | { name: string }[] | null }).customer
  );

  const lines = (
    (data as { so_lines: Array<Record<string, unknown>> | null }).so_lines ?? []
  ).map((row): ShippableSalesOrderLine => {
    const item = resolveJoin(row.items as { name: string } | { name: string }[] | null);
    const variant = resolveJoin(row.item_variants as { sku: string } | { sku: string }[] | null);
    const ordered = formatDecimal(row.quantity_ordered as number | string);
    const shipped = formatDecimal(row.quantity_shipped as number | string);
    const openQty = Math.max(0, Number(ordered) - Number(shipped));

    return {
      id: row.id as string,
      item_name: item?.name ?? "",
      variant_sku: variant?.sku ?? "",
      quantity_ordered: ordered,
      quantity_allocated: formatDecimal(row.quantity_allocated as number | string | null),
      quantity_shipped: shipped,
      open_quantity: String(openQty),
    };
  });

  return {
    id: data.id as string,
    voucher_number: data.voucher_number as string,
    customer_name: customer?.name ?? "",
    shipping_location_id: (data.shipping_location_id as string | null) ?? "",
    shipping_location_name: shippingLocation?.name ?? "",
    commercial_status: data.commercial_status as string,
    lines,
  };
}
