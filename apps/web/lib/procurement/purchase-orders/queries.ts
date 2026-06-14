import type { SupabaseClient } from "@supabase/supabase-js";
import { extractMrpFromCustomFieldsRecord } from "@/lib/products/catalog-reserved-fields";
import { parsePoLineTaxComponentsJson } from "@/lib/procurement/purchase-orders/po-line-tax-components";
import type { TaxTreatmentType } from "@/lib/entities/types";
import {
  isPoTaxSupplyNature,
  type PoTaxSupplyNature,
} from "@/lib/procurement/purchase-orders/po-tax-supply";
import type { GstTaxMechanism } from "@/lib/tax/gst-supply-context";
import type {
  PurchaseOrderLineRow,
  PurchaseOrderPartyAddress,
  PurchaseOrderRow,
  PurchaseOrderStatus,
  ReceivablePurchaseOrderOption,
  BillablePurchaseOrderOption,
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

type PoSelectShape = {
  includeAddresses: boolean;
  includeLineIds: boolean;
  includeTaxColumns: boolean;
  includeHeaderCharges: boolean;
};

const PO_LIST_SELECT_SHAPES: PoSelectShape[] = [
  { includeAddresses: true, includeLineIds: true, includeTaxColumns: true, includeHeaderCharges: true },
  { includeAddresses: false, includeLineIds: true, includeTaxColumns: true, includeHeaderCharges: true },
  { includeAddresses: false, includeLineIds: true, includeTaxColumns: true, includeHeaderCharges: false },
  { includeAddresses: false, includeLineIds: true, includeTaxColumns: false, includeHeaderCharges: false },
];

const PO_DETAIL_SELECT_SHAPES: PoSelectShape[] = [
  { includeAddresses: true, includeLineIds: true, includeTaxColumns: true, includeHeaderCharges: true },
  { includeAddresses: false, includeLineIds: true, includeTaxColumns: true, includeHeaderCharges: true },
  { includeAddresses: false, includeLineIds: true, includeTaxColumns: true, includeHeaderCharges: false },
  { includeAddresses: false, includeLineIds: true, includeTaxColumns: false, includeHeaderCharges: false },
];

function buildPoHeaderChargeFields(includeHeaderCharges: boolean): string {
  if (!includeHeaderCharges) return "";
  return `
      shipping_amount,
      shipping_tax_rate_pct,
      shipping_tax_amount,
      shipping_tax_type,
      round_off_amount,
      additional_charges_amount,
      transaction_discount_percentage,
      transaction_discount_amount,
      transaction_discount_type,`;
}

function buildPoHeaderTaxFields(includeTaxColumns: boolean): string {
  if (!includeTaxColumns) return "";
  return `
      prices_tax_inclusive,
      tax_supply_nature,
      tax_mechanism,
      supplier_tax_treatment,
      supplier_country_code,
      incoterms_code,
      rcm_applicable,`;
}

function buildPoLineTaxFields(includeTaxColumns: boolean): string {
  if (!includeTaxColumns) return "";
  return `
        tax_components_json,`;
}

function buildPurchaseOrderListSelect(options: PoSelectShape): string {
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
      total_tax_amount,
      total_net_amount,${buildPoHeaderChargeFields(options.includeHeaderCharges)}${buildPoHeaderTaxFields(options.includeTaxColumns)}
      custom_fields,
      created_by,
      created_at,
      updated_at,
      ${DESTINATION_LOCATION_EMBED} (${destinationFields}),
      ${SUPPLIER_EMBED} (${supplierFields}),
      ${PO_ITEMS_EMBED} (id)
    `;
}

function buildPurchaseOrderDetailSelect(options: PoSelectShape): string {
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
      total_tax_amount,
      total_net_amount,${buildPoHeaderChargeFields(options.includeHeaderCharges)}${buildPoHeaderTaxFields(options.includeTaxColumns)}
      custom_fields,
      created_by,
      created_at,
      updated_at,
      ${DESTINATION_LOCATION_EMBED} (${destinationFields}),
      ${SUPPLIER_EMBED} (${supplierFields}),
      ${PO_ITEMS_EMBED} (
        id,
        item_id,
        variant_id,
        uom_code,
        uom_conversion_factor,
        quantity_ordered,
        quantity_received,
        quantity_invoiced,
        unit_price_contractual,
        is_promotional,
        linked_parent_line_id,
        promo_group_id,
        promotional_category,
        discount_percentage,
        discount_amount,
        tax_rate_percentage,
        line_tax_amount,${buildPoLineTaxFields(options.includeTaxColumns)}
        line_total_gross,
        items!purchase_order_items_item_tenant_fk (name, base_unit_of_measure, custom_fields),
        item_variants!purchase_order_items_variant_tenant_fk (sku)
      )
    `;
}

function buildReceivablePurchaseOrderSelect(includeTaxColumns: boolean): string {
  return `
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
        uom_code,
        uom_conversion_factor,
        quantity_ordered,
        quantity_received,
        quantity_invoiced,
        unit_price_contractual,
        is_promotional,
        linked_parent_line_id,
        promo_group_id,
        promotional_category,
        discount_percentage,
        discount_amount,
        tax_rate_percentage,
        line_tax_amount,${buildPoLineTaxFields(includeTaxColumns)}
        line_total_gross,
        items!purchase_order_items_item_tenant_fk (name, base_unit_of_measure, custom_fields),
        item_variants!purchase_order_items_variant_tenant_fk (sku)
      )
    `;
}

async function runPoSelectWithFallback<T>(
  shapes: PoSelectShape[],
  run: (shape: PoSelectShape) => PromiseLike<{ data: T | null; error: { message: string } | null }>
): Promise<{ data: T | null; error: { message: string } | null }> {
  let lastResult: { data: T | null; error: { message: string } | null } = {
    data: null,
    error: null,
  };

  for (const shape of shapes) {
    lastResult = await run(shape);
    if (!lastResult.error) return lastResult;
    if (!isRecoverablePoSelectError(lastResult.error.message)) return lastResult;
  }

  return lastResult;
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
  total_tax_amount: number | string | null;
  total_net_amount: number | string;
  shipping_amount?: number | string | null;
  shipping_tax_rate_pct?: number | string | null;
  shipping_tax_amount?: number | string | null;
  shipping_tax_type?: string | null;
  round_off_amount?: number | string | null;
  additional_charges_amount?: number | string | null;
  transaction_discount_percentage?: number | string | null;
  transaction_discount_amount?: number | string | null;
  transaction_discount_type?: string | null;
  prices_tax_inclusive?: boolean | null;
  tax_supply_nature?: string | null;
  tax_mechanism?: string | null;
  supplier_tax_treatment?: string | null;
  supplier_country_code?: string | null;
  incoterms_code?: string | null;
  rcm_applicable?: boolean | null;
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
  uom_code: string;
  uom_conversion_factor?: number | string | null;
  quantity_ordered: number | string;
  quantity_received: number | string;
  quantity_invoiced?: number | string | null;
  unit_price_contractual: number | string;
  is_promotional?: boolean | null;
  linked_parent_line_id?: string | null;
  promo_group_id?: string | null;
  promotional_category?: string | null;
  discount_percentage?: number | string | null;
  discount_amount?: number | string | null;
  tax_rate_percentage?: number | string | null;
  line_tax_amount?: number | string | null;
  tax_components_json?: unknown;
  line_total_gross: number | string;
  items:
    | {
        name: string;
        base_unit_of_measure?: string | null;
        custom_fields?: Record<string, unknown> | null;
      }
    | {
        name: string;
        base_unit_of_measure?: string | null;
        custom_fields?: Record<string, unknown> | null;
      }[]
    | null;
  item_variants: { sku: string } | { sku: string }[] | null;
};

type ReceivablePoDbRow = {
  id: string;
  voucher_number: string;
  destination_location_id: string;
  tax_supply_nature?: string | null;
  destination_location: LocationEmbed;
  supplier: SupplierEmbed;
  po_lines?: PoLineDbRow[] | null;
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
  const invoiced = formatDecimal(row.quantity_invoiced ?? 0);
  const openQty = Math.max(0, Number(ordered) - Number(received));

  const unitPrice = formatDecimal(row.unit_price_contractual);

  return {
    id: row.id,
    item_id: row.item_id,
    item_name: item?.name ?? "",
    variant_id: row.variant_id,
    variant_sku: variant?.sku ?? "",
    uom_code: row.uom_code?.trim() || item?.base_unit_of_measure?.trim() || "PCS",
    uom_conversion_factor: formatDecimal(row.uom_conversion_factor ?? 1),
    base_unit_of_measure: item?.base_unit_of_measure?.trim() || null,
    mrp: extractMrpFromCustomFieldsRecord(item?.custom_fields) || null,
    quantity_ordered: ordered,
    quantity_received: received,
    quantity_invoiced: invoiced,
    unit_price_contractual: unitPrice,
    is_promotional: Boolean(row.is_promotional) || Number(unitPrice) === 0,
    linked_parent_line_id: row.linked_parent_line_id ?? null,
    promo_group_id: row.promo_group_id ?? null,
    promotional_category: row.promotional_category?.trim() || null,
    discount_percentage: formatDecimal(row.discount_percentage ?? 0),
    discount_amount: formatDecimal(row.discount_amount ?? 0),
    tax_rate_percentage: formatDecimal(row.tax_rate_percentage ?? 0),
    line_tax_amount: formatDecimal(row.line_tax_amount ?? 0),
    tax_components: parsePoLineTaxComponentsJson(row.tax_components_json),
    line_total_gross: formatDecimal(row.line_total_gross),
    open_quantity: String(openQty),
  };
}

const GST_TAX_MECHANISMS: GstTaxMechanism[] = [
  "FORWARD",
  "REVERSE_CHARGE",
  "IMPORT_IGST",
  "ZERO_RATED",
  "EXEMPT",
  "COMPOSITION",
];

function mapGstTaxMechanism(value: string | null | undefined): GstTaxMechanism {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (GST_TAX_MECHANISMS.includes(normalized as GstTaxMechanism)) {
    return normalized as GstTaxMechanism;
  }
  return "FORWARD";
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
    total_tax_amount: formatDecimal(row.total_tax_amount ?? 0),
    line_count: row.po_lines?.length ?? 0,
    total_net_amount: formatDecimal(row.total_net_amount),
    shipping_amount: formatDecimal(row.shipping_amount ?? 0),
    shipping_tax_rate_pct: formatDecimal(row.shipping_tax_rate_pct ?? 0),
    shipping_tax_amount: formatDecimal(row.shipping_tax_amount ?? 0),
    shipping_tax_type: row.shipping_tax_type === "amount" ? "amount" : "percent",
    round_off_amount: formatDecimal(row.round_off_amount ?? 0),
    additional_charges_amount: formatDecimal(row.additional_charges_amount ?? 0),
    transaction_discount_percentage: formatDecimal(row.transaction_discount_percentage ?? 0),
    transaction_discount_amount: formatDecimal(row.transaction_discount_amount ?? 0),
    transaction_discount_type:
      row.transaction_discount_type === "amount" ? "amount" : "percent",
    prices_tax_inclusive: row.prices_tax_inclusive === true,
    tax_supply_nature: isPoTaxSupplyNature(String(row.tax_supply_nature ?? ""))
      ? (row.tax_supply_nature as PoTaxSupplyNature)
      : "INTERSTATE",
    tax_mechanism: mapGstTaxMechanism(row.tax_mechanism),
    supplier_tax_treatment: (row.supplier_tax_treatment as TaxTreatmentType | null) ?? null,
    supplier_country_code: row.supplier_country_code?.trim() || null,
    incoterms_code: row.incoterms_code?.trim() || null,
    rcm_applicable: row.rcm_applicable === true,
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
  const { data, error } = await runPoSelectWithFallback<PoListDbRow[]>(
    PO_LIST_SELECT_SHAPES,
    (shape) => {
      let query = supabase
        .from("purchase_orders")
        .select(buildPurchaseOrderListSelect(shape))
        .eq("tenant_id", tenantId)
        .order("updated_at", { ascending: false });

      if (options?.locationId) {
        query = query.eq("destination_location_id", options.locationId);
      } else if (options?.locationIds?.length) {
        query = query.in("destination_location_id", options.locationIds);
      }

      if (options?.status) {
        query = query.eq("document_status", options.status);
      }

      return query;
    }
  );

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
  const { data, error } = await runPoSelectWithFallback<
    PoListDbRow & { po_lines?: PoLineDbRow[] | null }
  >(PO_DETAIL_SELECT_SHAPES, (shape) =>
    supabase
      .from("purchase_orders")
      .select(buildPurchaseOrderDetailSelect(shape))
      .eq("tenant_id", tenantId)
      .eq("id", purchaseOrderId)
      .maybeSingle()
  );

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
  const receivableShapes: PoSelectShape[] = [
    { includeAddresses: false, includeLineIds: true, includeTaxColumns: true },
    { includeAddresses: false, includeLineIds: true, includeTaxColumns: false },
  ];

  const { data, error } = await runPoSelectWithFallback<ReceivablePoDbRow[]>(
    receivableShapes,
    (shape) => {
      let query = supabase
        .from("purchase_orders")
        .select(buildReceivablePurchaseOrderSelect(shape.includeTaxColumns))
        .eq("tenant_id", tenantId)
        .in("document_status", ["ISSUED_ACTIVE", "PARTIALLY_FULFILLED"])
        .order("voucher_number");

      if (options?.locationId) {
        query = query.eq("destination_location_id", options.locationId);
      }

      return query;
    }
  );

  if (error) throw new Error(error.message);

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
        tax_supply_nature: isPoTaxSupplyNature(String(typed.tax_supply_nature ?? ""))
          ? (typed.tax_supply_nature as PoTaxSupplyNature)
          : "INTERSTATE",
        lines: openLines,
      } satisfies ReceivablePurchaseOrderOption;
    })
    .filter((row): row is ReceivablePurchaseOrderOption => row !== null);
}

export async function fetchBillablePurchaseOrders(
  supabase: SupabaseClient,
  tenantId: string,
  options?: { locationId?: string | null; supplierId?: string | null }
): Promise<BillablePurchaseOrderOption[]> {
  const billableShapes: PoSelectShape[] = [
    { includeAddresses: false, includeLineIds: true, includeTaxColumns: true, includeHeaderCharges: false },
    { includeAddresses: false, includeLineIds: true, includeTaxColumns: false, includeHeaderCharges: false },
  ];

  const { data, error } = await runPoSelectWithFallback<ReceivablePoDbRow[]>(
    billableShapes,
    (shape) => {
      let query = supabase
        .from("purchase_orders")
        .select(
          `
          id,
          voucher_number,
          supplier_id,
          destination_location_id,
          currency_code,
          document_status,
          tax_supply_nature,
          ${DESTINATION_LOCATION_EMBED} (name, code),
          ${SUPPLIER_EMBED} (name),
          ${PO_ITEMS_EMBED} (
            id,
            item_id,
            variant_id,
            uom_code,
            uom_conversion_factor,
            quantity_ordered,
            quantity_received,
            quantity_invoiced,
            unit_price_contractual,
            is_promotional,
            linked_parent_line_id,
            promo_group_id,
            promotional_category,
            discount_percentage,
            discount_amount,
            tax_rate_percentage,
            line_tax_amount,${buildPoLineTaxFields(shape.includeTaxColumns)}
            line_total_gross,
            items!purchase_order_items_item_tenant_fk (name, base_unit_of_measure, custom_fields),
            item_variants!purchase_order_items_variant_tenant_fk (sku)
          )
        `
        )
        .eq("tenant_id", tenantId)
        .in("document_status", ["ISSUED_ACTIVE", "PARTIALLY_FULFILLED", "FULLY_COMPLETED"])
        .order("voucher_number");

      if (options?.locationId) {
        query = query.eq("destination_location_id", options.locationId);
      }
      if (options?.supplierId) {
        query = query.eq("supplier_id", options.supplierId);
      }

      return query;
    }
  );

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row) => {
      const typed = row as ReceivablePoDbRow & {
        supplier_id: string;
        currency_code: string;
      };
      const destination = resolveJoin(typed.destination_location);
      const supplier = resolveJoin(typed.supplier);
      const lines = (typed.po_lines ?? []).map(mapPoLine);
      const billableLines = lines.filter((line) => {
        if (line.is_promotional) return false;
        const received = Number(line.quantity_received);
        const invoiced = Number(line.quantity_invoiced ?? 0);
        return received > 0 && received - invoiced > 0;
      });
      if (billableLines.length === 0) return null;

      return {
        id: typed.id,
        voucher_number: typed.voucher_number,
        supplier_id: typed.supplier_id,
        destination_location_id: typed.destination_location_id,
        destination_location_name: destination?.name ?? "",
        destination_location_code: destination?.code ?? "",
        supplier_name: supplier?.name ?? "",
        tax_supply_nature: isPoTaxSupplyNature(String(typed.tax_supply_nature ?? ""))
          ? (typed.tax_supply_nature as PoTaxSupplyNature)
          : "INTERSTATE",
        currency_code: typed.currency_code?.trim() || "INR",
        lines: billableLines,
      } satisfies BillablePurchaseOrderOption;
    })
    .filter((row): row is BillablePurchaseOrderOption => row !== null);
}
