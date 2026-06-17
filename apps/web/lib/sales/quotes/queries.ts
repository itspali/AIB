import type { SupabaseClient } from "@supabase/supabase-js";
import type { TaxTreatmentType } from "@/lib/entities/types";
import type { SalesDocumentStatus } from "@/lib/sales/shared/document-status";
import type { SalesQuoteLineRow, SalesQuoteRow } from "@/lib/sales/quotes/types";
import { fetchApprovalWorkflowCompleteByDocumentId } from "@/lib/sales/shared/approval-list-hydration";

const ORIGIN_LOCATION_EMBED =
  "origin_location:tenant_locations!sales_quotations_origin_location_tenant_fk";
const CUSTOMER_EMBED = "customer:entities!sales_quotations_customer_tenant_fk";
const CONVERTED_ORDER_EMBED =
  "converted_order:sales_orders!sales_quotations_converted_to_order_tenant_fk";
const CONVERTED_INVOICE_EMBED =
  "converted_invoice:sales_invoices!sales_quotations_converted_to_invoice_tenant_fk";
const QUOTE_ITEMS_EMBED =
  "quote_lines:sales_quotation_items!sales_quotation_items_quotation_tenant_fk";

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

async function hydrateQuoteApprovalSubmitters(
  supabase: SupabaseClient,
  tenantId: string,
  rows: SalesQuoteRow[]
): Promise<void> {
  const pendingIds = rows
    .filter((row) => row.commercial_status === "PENDING_APPROVAL")
    .map((row) => row.id);
  if (pendingIds.length === 0) return;

  const [{ data }, workflowCompleteIds] = await Promise.all([
    supabase
      .from("document_approval_requests")
      .select("document_id, submitted_by")
      .eq("tenant_id", tenantId)
      .eq("document_type", "SALES_QUOTATION")
      .eq("status", "PENDING")
      .in("document_id", pendingIds),
    fetchApprovalWorkflowCompleteByDocumentId(
      supabase,
      tenantId,
      "SALES_QUOTATION",
      pendingIds
    ),
  ]);

  const submitterById = new Map(
    (data ?? []).map((row) => [row.document_id as string, (row.submitted_by as string | null) ?? null])
  );

  for (const row of rows) {
    row.approval_submitted_by = submitterById.get(row.id) ?? null;
    row.approval_workflow_complete = workflowCompleteIds.has(row.id);
  }
}

async function hydrateQuoteCreatorNames(
  supabase: SupabaseClient,
  rows: SalesQuoteRow[]
): Promise<void> {
  const creatorIds = [...new Set(rows.map((row) => row.created_by).filter(Boolean))];
  if (creatorIds.length === 0) return;

  const { data } = await supabase
    .from("users")
    .select("id, first_name, last_name")
    .in("id", creatorIds);

  if (!data?.length) return;

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

type QuoteListDbRow = {
  id: string;
  quotation_number: string;
  customer_id: string;
  origin_location_id: string | null;
  commercial_status: string;
  valid_until: string;
  billing_state: string;
  shipping_state: string;
  payment_terms_days: number | null;
  total_gross_amount: number | string | null;
  total_tax_amount: number | string | null;
  total_net_amount: number | string;
  custom_fields: Record<string, unknown> | null;
  converted_to_order_id: string | null;
  converted_to_invoice_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  sent_by: string | null;
  send_channel: string | null;
  sent_to_email: string | null;
  origin_location: { name: string; code: string } | { name: string; code: string }[] | null;
  customer: { name: string; tax_treatment?: string | null } | { name: string; tax_treatment?: string | null }[] | null;
  converted_order: { voucher_number: string } | { voucher_number: string }[] | null;
  converted_invoice: { invoice_number: string } | { invoice_number: string }[] | null;
  quote_lines: Array<{ id: string }> | null;
};

type QuoteLineDbRow = {
  id: string;
  item_id: string;
  variant_id: string;
  quantity_quoted: number | string;
  unit_price_selling: number | string;
  discount_percentage?: number | string | null;
  discount_amount?: number | string | null;
  line_tax_amount?: number | string | null;
  line_total_gross: number | string;
  uom_code?: string | null;
  uom_conversion_factor?: number | string | null;
  items:
    | { name: string; base_unit_of_measure?: string | null }
    | { name: string; base_unit_of_measure?: string | null }[]
    | null;
  item_variants: { sku: string } | { sku: string }[] | null;
};

function mapQuoteLine(row: QuoteLineDbRow): SalesQuoteLineRow {
  const item = resolveJoin(row.items);
  const variant = resolveJoin(row.item_variants);

  return {
    id: row.id,
    item_id: row.item_id,
    item_name: item?.name ?? "",
    variant_id: row.variant_id,
    variant_sku: variant?.sku ?? "",
    quantity_quoted: formatDecimal(row.quantity_quoted),
    unit_price_selling: formatDecimal(row.unit_price_selling),
    discount_percentage: formatDecimal(row.discount_percentage ?? 0),
    discount_amount: formatDecimal(row.discount_amount ?? 0),
    line_tax_amount: formatDecimal(row.line_tax_amount ?? 0),
    line_total_gross: formatDecimal(row.line_total_gross),
    base_unit_of_measure: item?.base_unit_of_measure?.trim() || null,
    uom_code: row.uom_code?.trim() || item?.base_unit_of_measure?.trim() || null,
    uom_conversion_factor: formatDecimal(row.uom_conversion_factor ?? 1),
  };
}

function mapQuoteListRow(row: QuoteListDbRow): SalesQuoteRow {
  const originLocation = resolveJoin(row.origin_location);
  const customer = resolveJoin(row.customer);
  const convertedOrder = resolveJoin(row.converted_order);
  const convertedInvoice = resolveJoin(row.converted_invoice);

  return {
    id: row.id,
    quotation_number: row.quotation_number,
    customer_id: row.customer_id,
    customer_name: customer?.name ?? "",
    origin_location_id: row.origin_location_id,
    origin_location_name: originLocation?.name ?? "",
    origin_location_code: originLocation?.code ?? "",
    commercial_status: row.commercial_status as SalesDocumentStatus,
    valid_until: row.valid_until,
    billing_state: row.billing_state ?? "",
    shipping_state: row.shipping_state ?? "",
    payment_terms_days: Number(row.payment_terms_days) || 0,
    total_gross_amount: formatDecimal(row.total_gross_amount),
    total_tax_amount: formatDecimal(row.total_tax_amount ?? 0),
    line_count: row.quote_lines?.length ?? 0,
    total_net_amount: formatDecimal(row.total_net_amount),
    customer_tax_treatment: (customer?.tax_treatment as TaxTreatmentType | null) ?? null,
    custom_fields: row.custom_fields ?? {},
    converted_to_order_id: row.converted_to_order_id,
    converted_to_invoice_id: row.converted_to_invoice_id,
    converted_to_order_number: convertedOrder?.voucher_number ?? null,
    converted_to_invoice_number: convertedInvoice?.invoice_number ?? null,
    created_by: row.created_by,
    created_by_name: "",
    approval_submitted_by: null,
    approval_workflow_complete: false,
    sent_at: row.sent_at ?? null,
    sent_by: row.sent_by ?? null,
    send_channel: row.send_channel ?? null,
    sent_to_email: row.sent_to_email ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const QUOTE_LIST_SELECT = `
  id,
  quotation_number,
  customer_id,
  origin_location_id,
  commercial_status,
  valid_until,
  billing_state,
  shipping_state,
  payment_terms_days,
  total_gross_amount,
  total_tax_amount,
  total_net_amount,
  custom_fields,
  converted_to_order_id,
  converted_to_invoice_id,
  sent_at,
  sent_by,
  send_channel,
  sent_to_email,
  created_by,
  created_at,
  updated_at,
  ${ORIGIN_LOCATION_EMBED} (name, code),
  ${CUSTOMER_EMBED} (name, tax_treatment),
  ${CONVERTED_ORDER_EMBED} (voucher_number),
  ${CONVERTED_INVOICE_EMBED} (invoice_number),
  ${QUOTE_ITEMS_EMBED} (id)
`;

const QUOTE_DETAIL_SELECT = `
  id,
  quotation_number,
  customer_id,
  origin_location_id,
  commercial_status,
  valid_until,
  billing_state,
  shipping_state,
  payment_terms_days,
  total_gross_amount,
  total_tax_amount,
  total_net_amount,
  custom_fields,
  converted_to_order_id,
  converted_to_invoice_id,
  sent_at,
  sent_by,
  send_channel,
  sent_to_email,
  created_by,
  created_at,
  updated_at,
  ${ORIGIN_LOCATION_EMBED} (name, code),
  ${CUSTOMER_EMBED} (name, tax_treatment),
  ${CONVERTED_ORDER_EMBED} (voucher_number),
  ${CONVERTED_INVOICE_EMBED} (invoice_number),
  ${QUOTE_ITEMS_EMBED} (
    id,
    item_id,
    variant_id,
    quantity_quoted,
    unit_price_selling,
    discount_percentage,
    discount_amount,
    line_tax_amount,
    line_total_gross,
    uom_code,
    uom_conversion_factor,
    items!sales_quotation_items_item_tenant_fk (name, base_unit_of_measure),
    item_variants!sales_quotation_items_variant_tenant_fk (sku)
  )
`;

export async function fetchSalesQuotations(
  supabase: SupabaseClient,
  tenantId: string,
  options?: { status?: SalesDocumentStatus | null }
): Promise<SalesQuoteRow[]> {
  let query = supabase
    .from("sales_quotations")
    .select(QUOTE_LIST_SELECT)
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false });

  if (options?.status) {
    query = query.eq("commercial_status", options.status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((row) => mapQuoteListRow(row as QuoteListDbRow));
  await Promise.all([
    hydrateQuoteCreatorNames(supabase, rows),
    hydrateQuoteApprovalSubmitters(supabase, tenantId, rows),
  ]);
  return rows;
}

export async function fetchSalesQuotationById(
  supabase: SupabaseClient,
  tenantId: string,
  quotationId: string
): Promise<SalesQuoteRow | null> {
  const { data, error } = await supabase
    .from("sales_quotations")
    .select(QUOTE_DETAIL_SELECT)
    .eq("tenant_id", tenantId)
    .eq("id", quotationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as QuoteListDbRow & { quote_lines?: QuoteLineDbRow[] | null };
  const mapped = mapQuoteListRow(row);
  mapped.lines = (row.quote_lines ?? []).map(mapQuoteLine);
  await Promise.all([
    hydrateQuoteCreatorNames(supabase, [mapped]),
    hydrateQuoteApprovalSubmitters(supabase, tenantId, [mapped]),
  ]);
  return mapped;
}
