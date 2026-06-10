import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PurchaseOrderLineRow,
  PurchaseOrderPartyAddress,
  PurchaseOrderRow,
  PurchaseOrderStatus,
  ReceivablePurchaseOrderOption,
} from "@/lib/procurement/purchase-orders/types";

const DESTINATION_LOCATION_EMBED =
  "destination_location:tenant_locations!purchase_orders_location_tenant_fk";
const SUPPLIER_EMBED = "supplier:entities!purchase_orders_supplier_tenant_fk";
const PO_ITEMS_EMBED =
  "po_lines:purchase_order_items!purchase_order_items_po_tenant_fk";

const PO_DESTINATION_ADDRESS_FIELDS = `
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

const PO_SUPPLIER_ADDRESS_FIELDS = `
        name,
        legal_name,
        billing_address_line1,
        billing_address_line2,
        billing_city,
        billing_state,
        billing_zip_postal,
        billing_country_code,
        tax_registration_number
      `;

const PO_DESTINATION_MINIMAL_FIELDS = "name, code";
const PO_SUPPLIER_MINIMAL_FIELDS = "name";

function isRecoverablePoSelectError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("could not find") ||
    normalized.includes("schema cache") ||
    normalized.includes("column") ||
    normalized.includes("relationship") ||
    normalized.includes("foreign key")
  );
}

function buildPurchaseOrderListSelect(options: {
  includeAddresses: boolean;
  includeLineIds: boolean;
}): string {
  const destinationFields = options.includeAddresses
    ? PO_DESTINATION_ADDRESS_FIELDS
    : PO_DESTINATION_MINIMAL_FIELDS;
  const supplierFields = options.includeAddresses
    ? PO_SUPPLIER_ADDRESS_FIELDS
    : PO_SUPPLIER_MINIMAL_FIELDS;

  return `
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
      created_by,
      created_at,
      updated_at,
      ${DESTINATION_LOCATION_EMBED} (${destinationFields}),
      ${SUPPLIER_EMBED} (${supplierFields}),
      ${PO_ITEMS_EMBED} (id)
    `;
}

type LocationEmbed =
  | {
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
    }
  | Array<{
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
    }>
  | null;
type SupplierEmbed =
  | {
      name: string;
      legal_name?: string | null;
      billing_address_line1?: string | null;
      billing_address_line2?: string | null;
      billing_city?: string | null;
      billing_state?: string | null;
      billing_zip_postal?: string | null;
      billing_country_code?: string | null;
      tax_registration_number?: string | null;
    }
  | Array<{
      name: string;
      legal_name?: string | null;
      billing_address_line1?: string | null;
      billing_address_line2?: string | null;
      billing_city?: string | null;
      billing_state?: string | null;
      billing_zip_postal?: string | null;
      billing_country_code?: string | null;
      tax_registration_number?: string | null;
    }>
  | null;

async function hydratePurchaseOrderCreatorNames(
  supabase: SupabaseClient,
  rows: PurchaseOrderRow[]
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
  created_by: string;
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
  discount_percentage?: number | string | null;
  discount_amount?: number | string | null;
  line_total_gross: number | string;
  items: { name: string; base_unit_of_measure?: string | null } | { name: string; base_unit_of_measure?: string | null }[] | null;
  item_variants: { sku: string } | { sku: string }[] | null;
};

function mapSupplierAddress(
  supplier: ReturnType<typeof resolveJoin<NonNullable<SupplierEmbed>>>,
  fallbackName: string
): PurchaseOrderPartyAddress | null {
  if (!supplier) return null;

  const name = supplier.legal_name?.trim() || supplier.name?.trim() || fallbackName.trim();
  const address: PurchaseOrderPartyAddress = {
    name,
    address_line1: supplier.billing_address_line1?.trim() || null,
    address_line2: supplier.billing_address_line2?.trim() || null,
    city: supplier.billing_city?.trim() || null,
    state: supplier.billing_state?.trim() || null,
    zip_postal: supplier.billing_zip_postal?.trim() || null,
    country_code: supplier.billing_country_code?.trim() || null,
    tax_identifier: supplier.tax_registration_number?.trim() || null,
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

function mapDestinationAddress(
  destination: ReturnType<typeof resolveJoin<NonNullable<LocationEmbed>>>,
  fallbackName: string
): PurchaseOrderPartyAddress | null {
  if (!destination) return null;

  const name =
    destination.tax_registered_name?.trim() ||
    destination.name?.trim() ||
    fallbackName.trim();

  return {
    name,
    address_line1: destination.address_line1?.trim() || null,
    address_line2: destination.address_line2?.trim() || null,
    city: destination.city?.trim() || null,
    state: destination.state?.trim() || null,
    zip_postal: destination.zip_postal?.trim() || null,
    country_code: destination.country_code?.trim() || null,
    tax_identifier: destination.location_tax_identifier?.trim() || null,
  };
}

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
    base_unit_of_measure: item?.base_unit_of_measure?.trim() || null,
    quantity_ordered: ordered,
    quantity_received: received,
    unit_price_contractual: formatDecimal(row.unit_price_contractual),
    discount_percentage: formatDecimal(row.discount_percentage ?? 0),
    discount_amount: formatDecimal(row.discount_amount ?? 0),
    line_total_gross: formatDecimal(row.line_total_gross),
    open_quantity: String(openQty),
  };
}

function mapPoListRow(row: PoListDbRow): PurchaseOrderRow {
  const destination = resolveJoin(row.destination_location);
  const supplier = resolveJoin(row.supplier);
  const supplierName = supplier?.name ?? "";

  return {
    id: row.id,
    voucher_number: row.voucher_number,
    destination_location_id: row.destination_location_id,
    destination_location_name: destination?.name ?? "",
    destination_location_code: destination?.code ?? "",
    supplier_id: row.supplier_id,
    supplier_name: supplierName,
    supplier_address: mapSupplierAddress(supplier, supplierName),
    destination_address: mapDestinationAddress(destination, destination?.name ?? ""),
    document_status: row.document_status as PurchaseOrderStatus,
    currency_code: row.currency_code ?? "USD",
    payment_terms_days: Number(row.payment_terms_days) || 0,
    total_gross_amount: formatDecimal(row.total_gross_amount),
    line_count: row.po_lines?.length ?? 0,
    total_net_amount: formatDecimal(row.total_net_amount),
    custom_fields: row.custom_fields ?? {},
    created_by: row.created_by,
    created_by_name: "",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function fetchPurchaseOrders(
  supabase: SupabaseClient,
  tenantId: string,
  options?: {
    locationId?: string | null;
    locationIds?: string[] | null;
    status?: PurchaseOrderStatus | null;
  }
): Promise<PurchaseOrderRow[]> {
  const runQuery = (includeAddresses: boolean) =>
    supabase
      .from("purchase_orders")
      .select(buildPurchaseOrderListSelect({ includeAddresses, includeLineIds: true }))
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false });

  let query = runQuery(true);

  if (options?.locationId) {
    query = query.eq("destination_location_id", options.locationId);
  } else if (options?.locationIds?.length) {
    query = query.in("destination_location_id", options.locationIds);
  }

  if (options?.status) {
    query = query.eq("document_status", options.status);
  }

  let { data, error } = await query;

  if (error && isRecoverablePoSelectError(error.message)) {
    let fallbackQuery = runQuery(false);
    if (options?.locationId) {
      fallbackQuery = fallbackQuery.eq("destination_location_id", options.locationId);
    } else if (options?.locationIds?.length) {
      fallbackQuery = fallbackQuery.in("destination_location_id", options.locationIds);
    }
    if (options?.status) {
      fallbackQuery = fallbackQuery.eq("document_status", options.status);
    }
    ({ data, error } = await fallbackQuery);
  }

  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((row) => mapPoListRow(row as PoListDbRow));
  await hydratePurchaseOrderCreatorNames(supabase, rows);
  return rows;
}

export async function fetchPurchaseOrderById(
  supabase: SupabaseClient,
  tenantId: string,
  purchaseOrderId: string
): Promise<PurchaseOrderRow | null> {
  const runQuery = (includeAddresses: boolean) =>
    supabase
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
      created_by,
      created_at,
      updated_at,
      ${DESTINATION_LOCATION_EMBED} (${includeAddresses ? PO_DESTINATION_ADDRESS_FIELDS : PO_DESTINATION_MINIMAL_FIELDS}),
      ${SUPPLIER_EMBED} (${includeAddresses ? PO_SUPPLIER_ADDRESS_FIELDS : PO_SUPPLIER_MINIMAL_FIELDS}),
      ${PO_ITEMS_EMBED} (
        id,
        item_id,
        variant_id,
        quantity_ordered,
        quantity_received,
        unit_price_contractual,
        discount_percentage,
        discount_amount,
        line_total_gross,
        items!purchase_order_items_item_tenant_fk (name, base_unit_of_measure),
        item_variants!purchase_order_items_variant_tenant_fk (sku)
      )
    `
      )
      .eq("tenant_id", tenantId)
      .eq("id", purchaseOrderId)
      .maybeSingle();

  let { data, error } = await runQuery(true);

  if (error && isRecoverablePoSelectError(error.message)) {
    ({ data, error } = await runQuery(false));
  }

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as PoListDbRow & { po_lines?: PoLineDbRow[] | null };
  const mapped = mapPoListRow(row);
  mapped.lines = (row.po_lines ?? []).map(mapPoLine);
  await hydratePurchaseOrderCreatorNames(supabase, [mapped]);
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
        discount_percentage,
        discount_amount,
        line_total_gross,
        items!purchase_order_items_item_tenant_fk (name, base_unit_of_measure),
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
