import type { SupabaseClient } from "@supabase/supabase-js";
import type { TaxTreatmentType } from "@/lib/entities/types";
import type {
  SalesFulfillmentStatus,
  SalesOrderLineRow,
  SalesOrderPartyAddress,
  SalesOrderRow,
  SalesOrderStatus,
  SalesPaymentStatus,
} from "@/lib/sales/orders/types";

const SHIPPING_LOCATION_EMBED =
  "shipping_location:tenant_locations!sales_orders_shipping_location_tenant_fk";
const CUSTOMER_EMBED = "customer:entities!sales_orders_customer_tenant_fk";
const SO_ITEMS_EMBED = "so_lines:sales_order_items!sales_order_items_order_tenant_fk";

const SO_SHIPPING_ADDRESS_FIELDS = `
        name,
        code,
        address_line1,
        address_line2,
        city,
        state,
        zip_postal,
        country_code,
        location_tax_identifier,
        tax_registered_name
      `;

const SO_CUSTOMER_ADDRESS_FIELDS = `
        name,
        legal_name,
        billing_address_line1,
        billing_address_line2,
        billing_city,
        billing_state,
        billing_zip_postal,
        billing_country_code,
        tax_registration_number,
        tax_treatment
      `;

const SO_SHIPPING_MINIMAL_FIELDS = "name, code";
const SO_CUSTOMER_MINIMAL_FIELDS = "name, tax_treatment";

function isRecoverableSoSelectError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("could not find") ||
    normalized.includes("schema cache") ||
    normalized.includes("column") ||
    normalized.includes("relationship") ||
    normalized.includes("foreign key")
  );
}

type SoSelectShape = {
  includeAddresses: boolean;
  includeLineIds: boolean;
  includeQuantityInvoiced: boolean;
};

const SO_LIST_SELECT_SHAPES: SoSelectShape[] = [
  { includeAddresses: true, includeLineIds: true, includeQuantityInvoiced: true },
  { includeAddresses: false, includeLineIds: true, includeQuantityInvoiced: true },
  { includeAddresses: false, includeLineIds: true, includeQuantityInvoiced: false },
];

const SO_DETAIL_SELECT_SHAPES: SoSelectShape[] = [
  { includeAddresses: true, includeLineIds: true, includeQuantityInvoiced: true },
  { includeAddresses: false, includeLineIds: true, includeQuantityInvoiced: true },
  { includeAddresses: false, includeLineIds: true, includeQuantityInvoiced: false },
];

function buildSoLineQuantityFields(includeQuantityInvoiced: boolean): string {
  if (!includeQuantityInvoiced) return "";
  return `
        quantity_invoiced,`;
}

function buildSalesOrderListSelect(options: SoSelectShape): string {
  const shippingFields = options.includeAddresses
    ? SO_SHIPPING_ADDRESS_FIELDS
    : SO_SHIPPING_MINIMAL_FIELDS;
  const customerFields = options.includeAddresses
    ? SO_CUSTOMER_ADDRESS_FIELDS
    : SO_CUSTOMER_MINIMAL_FIELDS;

  return `
      id,
      voucher_number,
      customer_id,
      shipping_location_id,
      source_quotation_id,
      commercial_status,
      fulfillment_status,
      payment_status,
      billing_state,
      shipping_state,
      total_gross_amount,
      total_tax_amount,
      total_net_amount,
      custom_fields,
      created_by,
      created_at,
      updated_at,
      ${SHIPPING_LOCATION_EMBED} (${shippingFields}),
      ${CUSTOMER_EMBED} (${customerFields}),
      ${SO_ITEMS_EMBED} (id)
    `;
}

function buildSalesOrderDetailSelect(options: SoSelectShape): string {
  const shippingFields = options.includeAddresses
    ? SO_SHIPPING_ADDRESS_FIELDS
    : SO_SHIPPING_MINIMAL_FIELDS;
  const customerFields = options.includeAddresses
    ? SO_CUSTOMER_ADDRESS_FIELDS
    : SO_CUSTOMER_MINIMAL_FIELDS;

  return `
      id,
      voucher_number,
      customer_id,
      shipping_location_id,
      source_quotation_id,
      commercial_status,
      fulfillment_status,
      payment_status,
      billing_state,
      shipping_state,
      total_gross_amount,
      total_tax_amount,
      total_net_amount,
      custom_fields,
      created_by,
      created_at,
      updated_at,
      ${SHIPPING_LOCATION_EMBED} (${shippingFields}),
      ${CUSTOMER_EMBED} (${customerFields}),
      ${SO_ITEMS_EMBED} (
        id,
        item_id,
        variant_id,
        quantity_ordered,
        quantity_shipped,${buildSoLineQuantityFields(options.includeQuantityInvoiced)}
        unit_price_selling,
        discount_percentage,
        discount_amount,
        line_tax_amount,
        line_total_gross,
        items!sales_order_items_item_tenant_fk (name, base_unit_of_measure),
        item_variants!sales_order_items_variant_tenant_fk (sku)
      )
    `;
}

async function runSoSelectWithFallback<T>(
  shapes: SoSelectShape[],
  run: (shape: SoSelectShape) => PromiseLike<{ data: T | null; error: { message: string } | null }>
): Promise<{ data: T | null; error: { message: string } | null }> {
  let lastResult: { data: T | null; error: { message: string } | null } = {
    data: null,
    error: null,
  };

  for (const shape of shapes) {
    lastResult = await run(shape);
    if (!lastResult.error) return lastResult;
    if (!isRecoverableSoSelectError(lastResult.error.message)) return lastResult;
  }

  return lastResult;
}

type CustomerEmbedRow = {
  name: string;
  legal_name?: string | null;
  billing_address_line1?: string | null;
  billing_address_line2?: string | null;
  billing_city?: string | null;
  billing_state?: string | null;
  billing_zip_postal?: string | null;
  billing_country_code?: string | null;
  tax_registration_number?: string | null;
  tax_treatment?: string | null;
};
type CustomerEmbed = CustomerEmbedRow | CustomerEmbedRow[] | null;
type LocationEmbedRow = {
  name: string;
  code: string;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  zip_postal?: string | null;
  country_code?: string | null;
  location_tax_identifier?: string | null;
  tax_registered_name?: string | null;
};
type LocationEmbed = LocationEmbedRow | LocationEmbedRow[] | null;

async function hydrateSalesOrderApprovalSubmitters(
  supabase: SupabaseClient,
  tenantId: string,
  rows: SalesOrderRow[]
): Promise<void> {
  const pendingIds = rows
    .filter((row) => row.commercial_status === "PENDING_APPROVAL")
    .map((row) => row.id);
  if (pendingIds.length === 0) return;

  const { data, error } = await supabase
    .from("document_approval_requests")
    .select("document_id, submitted_by")
    .eq("tenant_id", tenantId)
    .eq("document_type", "SALES_ORDER")
    .eq("status", "PENDING")
    .in("document_id", pendingIds);

  if (error || !data?.length) return;

  const submitterBySoId = new Map(
    data.map((row) => [row.document_id as string, (row.submitted_by as string | null) ?? null])
  );

  for (const row of rows) {
    row.approval_submitted_by = submitterBySoId.get(row.id) ?? null;
  }
}

async function hydrateSalesOrderCreatorNames(
  supabase: SupabaseClient,
  rows: SalesOrderRow[]
): Promise<void> {
  const creatorIds = [...new Set(rows.map((row) => row.created_by).filter(Boolean))];
  if (creatorIds.length === 0) return;

  const { data, error } = await supabase
    .from("users")
    .select("id, first_name, last_name")
    .in("id", creatorIds);

  if (error || !data?.length) return;

  const nameById = new Map(
    data.map((user) => [
      user.id as string,
      `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim(),
    ])
  );

  for (const row of rows) {
    row.created_by_name = nameById.get(row.created_by) ?? "";
  }
}

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

type SoListDbRow = {
  id: string;
  voucher_number: string;
  customer_id: string;
  shipping_location_id: string | null;
  source_quotation_id: string | null;
  commercial_status: string;
  fulfillment_status: string;
  payment_status: string;
  billing_state: string;
  shipping_state: string;
  total_gross_amount: number | string | null;
  total_tax_amount: number | string | null;
  total_net_amount: number | string;
  custom_fields: Record<string, unknown> | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  shipping_location: LocationEmbed;
  customer: CustomerEmbed;
  so_lines: Array<{ id: string }> | null;
};

type SoLineDbRow = {
  id: string;
  item_id: string;
  variant_id: string;
  quantity_ordered: number | string;
  quantity_shipped: number | string;
  quantity_invoiced?: number | string | null;
  unit_price_selling: number | string;
  discount_percentage?: number | string | null;
  discount_amount?: number | string | null;
  line_tax_amount?: number | string | null;
  line_total_gross: number | string;
  items:
    | {
        name: string;
        base_unit_of_measure?: string | null;
      }
    | {
        name: string;
        base_unit_of_measure?: string | null;
      }[]
    | null;
  item_variants: { sku: string } | { sku: string }[] | null;
};

function mapCustomerAddress(
  customer: CustomerEmbed,
  fallbackName: string
): SalesOrderPartyAddress | null {
  const resolved = resolveJoin(customer);
  if (!resolved) return null;

  const name = resolved.legal_name?.trim() || resolved.name?.trim() || fallbackName.trim();
  const address: SalesOrderPartyAddress = {
    name,
    address_line1: resolved.billing_address_line1?.trim() || null,
    address_line2: resolved.billing_address_line2?.trim() || null,
    city: resolved.billing_city?.trim() || null,
    state: resolved.billing_state?.trim() || null,
    zip_postal: resolved.billing_zip_postal?.trim() || null,
    country_code: resolved.billing_country_code?.trim() || null,
    tax_identifier: resolved.tax_registration_number?.trim() || null,
  };

  if (
    !address.address_line1 &&
    !address.address_line2 &&
    !address.city &&
    !address.state &&
    !address.zip_postal &&
    !address.country_code &&
    !address.tax_identifier
  ) {
    return name ? { ...address, name } : null;
  }

  return address;
}

function mapShippingAddress(
  shippingLocation: LocationEmbed,
  fallbackName: string
): SalesOrderPartyAddress | null {
  const resolved = resolveJoin(shippingLocation);
  if (!resolved) return null;

  const name =
    resolved.tax_registered_name?.trim() ||
    resolved.name?.trim() ||
    fallbackName.trim();

  return {
    name,
    address_line1: resolved.address_line1?.trim() || null,
    address_line2: resolved.address_line2?.trim() || null,
    city: resolved.city?.trim() || null,
    state: resolved.state?.trim() || null,
    zip_postal: resolved.zip_postal?.trim() || null,
    country_code: resolved.country_code?.trim() || null,
    tax_identifier: resolved.location_tax_identifier?.trim() || null,
  };
}

function mapSoLine(row: SoLineDbRow): SalesOrderLineRow {
  const item = resolveJoin(row.items);
  const variant = resolveJoin(row.item_variants);
  const ordered = formatDecimal(row.quantity_ordered);
  const shipped = formatDecimal(row.quantity_shipped);
  const invoiced = formatDecimal(row.quantity_invoiced ?? 0);
  const openQty = Math.max(0, Number(ordered) - Number(shipped));

  return {
    id: row.id,
    item_id: row.item_id,
    item_name: item?.name ?? "",
    variant_id: row.variant_id,
    variant_sku: variant?.sku ?? "",
    quantity_ordered: ordered,
    quantity_shipped: shipped,
    quantity_invoiced: invoiced,
    unit_price_selling: formatDecimal(row.unit_price_selling),
    discount_percentage: formatDecimal(row.discount_percentage ?? 0),
    discount_amount: formatDecimal(row.discount_amount ?? 0),
    line_tax_amount: formatDecimal(row.line_tax_amount ?? 0),
    line_total_gross: formatDecimal(row.line_total_gross),
    open_quantity: String(openQty),
    base_unit_of_measure: item?.base_unit_of_measure?.trim() || null,
  };
}

function mapSoListRow(row: SoListDbRow): SalesOrderRow {
  const shippingLocation = resolveJoin(row.shipping_location);
  const customer = resolveJoin(row.customer);
  const customerName = customer?.name ?? "";

  return {
    id: row.id,
    voucher_number: row.voucher_number,
    customer_id: row.customer_id,
    customer_name: customerName,
    customer_address: mapCustomerAddress(customer, customerName),
    shipping_location_id: row.shipping_location_id,
    shipping_location_name: shippingLocation?.name ?? "",
    shipping_location_code: shippingLocation?.code ?? "",
    shipping_address: mapShippingAddress(shippingLocation, shippingLocation?.name ?? ""),
    commercial_status: row.commercial_status as SalesOrderStatus,
    fulfillment_status: row.fulfillment_status as SalesFulfillmentStatus,
    payment_status: row.payment_status as SalesPaymentStatus,
    billing_state: row.billing_state ?? "",
    shipping_state: row.shipping_state ?? "",
    total_gross_amount: formatDecimal(row.total_gross_amount),
    total_tax_amount: formatDecimal(row.total_tax_amount ?? 0),
    line_count: row.so_lines?.length ?? 0,
    total_net_amount: formatDecimal(row.total_net_amount),
    customer_tax_treatment: (customer?.tax_treatment as TaxTreatmentType | null) ?? null,
    custom_fields: row.custom_fields ?? {},
    source_quotation_id: row.source_quotation_id,
    created_by: row.created_by,
    created_by_name: "",
    approval_submitted_by: null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function fetchSalesOrders(
  supabase: SupabaseClient,
  tenantId: string,
  options?: {
    locationId?: string | null;
    locationIds?: string[] | null;
    status?: SalesOrderStatus | null;
  }
): Promise<SalesOrderRow[]> {
  const { data, error } = await runSoSelectWithFallback<SoListDbRow[]>(
    SO_LIST_SELECT_SHAPES,
    (shape) => {
      let query = supabase
        .from("sales_orders")
        .select(buildSalesOrderListSelect(shape))
        .eq("tenant_id", tenantId)
        .order("updated_at", { ascending: false });

      if (options?.locationId) {
        query = query.eq("shipping_location_id", options.locationId);
      } else if (options?.locationIds?.length) {
        query = query.in("shipping_location_id", options.locationIds);
      }

      if (options?.status) {
        query = query.eq("commercial_status", options.status);
      }

      return query as unknown as Promise<{ data: SoListDbRow[] | null; error: { message: string } | null }>;
    }
  );

  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((row) => mapSoListRow(row as SoListDbRow));
  await Promise.all([
    hydrateSalesOrderCreatorNames(supabase, rows),
    hydrateSalesOrderApprovalSubmitters(supabase, tenantId, rows),
  ]);
  return rows;
}

export async function fetchSalesOrderById(
  supabase: SupabaseClient,
  tenantId: string,
  salesOrderId: string
): Promise<SalesOrderRow | null> {
  const { data, error } = await runSoSelectWithFallback<
    SoListDbRow & { so_lines?: SoLineDbRow[] | null }
  >(SO_DETAIL_SELECT_SHAPES, (shape) =>
    supabase
      .from("sales_orders")
      .select(buildSalesOrderDetailSelect(shape))
      .eq("tenant_id", tenantId)
      .eq("id", salesOrderId)
      .maybeSingle()
  );

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as SoListDbRow & { so_lines?: SoLineDbRow[] | null };
  const mapped = mapSoListRow(row);
  mapped.lines = (row.so_lines ?? []).map(mapSoLine);
  await Promise.all([
    hydrateSalesOrderCreatorNames(supabase, [mapped]),
    hydrateSalesOrderApprovalSubmitters(supabase, tenantId, [mapped]),
  ]);
  return mapped;
}
