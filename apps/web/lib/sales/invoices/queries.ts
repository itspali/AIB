import type { SupabaseClient } from "@supabase/supabase-js";
import type { TaxTreatmentType } from "@/lib/entities/types";
import type { SalesDocumentStatus } from "@/lib/sales/shared/document-status";
import type { SalesPaymentStatus } from "@/lib/sales/orders/types";
import type {
  InvoicePaymentApplicationRow,
  OpenSalesInvoiceOption,
  SalesInvoiceLineRow,
  SalesInvoiceRow,
} from "@/lib/sales/invoices/types";
import { fetchApprovalWorkflowCompleteByDocumentId } from "@/lib/sales/shared/approval-list-hydration";

const ORIGIN_LOCATION_EMBED =
  "origin_location:tenant_locations!sales_invoices_origin_location_tenant_fk";
const CUSTOMER_EMBED = "customer:entities!sales_invoices_customer_tenant_fk";
const SOURCE_ORDER_EMBED = "source_order:sales_orders!sales_invoices_order_tenant_fk";
const SOURCE_QUOTATION_EMBED =
  "source_quotation:sales_quotations!sales_invoices_source_quotation_tenant_fk";
const INVOICE_ITEMS_EMBED =
  "invoice_lines:sales_invoice_items!sales_invoice_items_invoice_tenant_fk";

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

async function hydrateInvoiceApprovalSubmitters(
  supabase: SupabaseClient,
  tenantId: string,
  rows: SalesInvoiceRow[]
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
      .eq("document_type", "SALES_INVOICE")
      .eq("status", "PENDING")
      .in("document_id", pendingIds),
    fetchApprovalWorkflowCompleteByDocumentId(supabase, tenantId, "SALES_INVOICE", pendingIds),
  ]);

  const submitterById = new Map(
    (data ?? []).map((row) => [
      row.document_id as string,
      (row.submitted_by as string | null) ?? null,
    ])
  );

  for (const row of rows) {
    row.approval_submitted_by = submitterById.get(row.id) ?? null;
    row.approval_workflow_complete = workflowCompleteIds.has(row.id);
  }
}

async function hydrateInvoiceCreatorNames(
  supabase: SupabaseClient,
  rows: SalesInvoiceRow[]
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

type InvoiceListDbRow = {
  id: string;
  invoice_number: string;
  customer_id: string;
  origin_location_id: string;
  source_order_id: string | null;
  source_quotation_id: string | null;
  commercial_status: string;
  invoice_payment_status: string;
  billing_state: string;
  shipping_state: string;
  payment_terms_days: number | null;
  total_gross_amount: number | string | null;
  total_tax_amount: number | string | null;
  total_net_amount: number | string;
  total_paid_amount: number | string | null;
  custom_fields: Record<string, unknown> | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  origin_location: { name: string; code: string } | { name: string; code: string }[] | null;
  customer: { name: string; tax_treatment?: string | null } | { name: string; tax_treatment?: string | null }[] | null;
  source_order: { voucher_number: string } | { voucher_number: string }[] | null;
  source_quotation: { quotation_number: string } | { quotation_number: string }[] | null;
  invoice_lines: Array<{ id: string }> | null;
};

type InvoiceLineDbRow = {
  id: string;
  item_id: string;
  variant_id: string;
  source_order_line_id: string | null;
  source_quotation_line_id?: string | null;
  quantity_invoiced: number | string;
  unit_price_selling: number | string;
  discount_percentage?: number | string | null;
  discount_amount?: number | string | null;
  line_tax_amount?: number | string | null;
  line_total_net: number | string;
  uom_code?: string | null;
  uom_conversion_factor?: number | string | null;
  items:
    | { name: string; base_unit_of_measure?: string | null }
    | { name: string; base_unit_of_measure?: string | null }[]
    | null;
  item_variants: { sku: string } | { sku: string }[] | null;
};

function mapInvoiceLine(row: InvoiceLineDbRow): SalesInvoiceLineRow {
  const item = resolveJoin(row.items);
  const variant = resolveJoin(row.item_variants);

  return {
    id: row.id,
    item_id: row.item_id,
    item_name: item?.name ?? "",
    variant_id: row.variant_id,
    variant_sku: variant?.sku ?? "",
    quantity_invoiced: formatDecimal(row.quantity_invoiced),
    unit_price_selling: formatDecimal(row.unit_price_selling),
    discount_percentage: formatDecimal(row.discount_percentage ?? 0),
    discount_amount: formatDecimal(row.discount_amount ?? 0),
    line_tax_amount: formatDecimal(row.line_tax_amount ?? 0),
    line_total_net: formatDecimal(row.line_total_net),
    source_order_line_id: row.source_order_line_id,
    source_quotation_line_id: row.source_quotation_line_id ?? null,
    base_unit_of_measure: item?.base_unit_of_measure?.trim() || null,
    uom_code: row.uom_code?.trim() || item?.base_unit_of_measure?.trim() || null,
    uom_conversion_factor: formatDecimal(row.uom_conversion_factor ?? 1),
  };
}

function mapInvoiceListRow(row: InvoiceListDbRow): SalesInvoiceRow {
  const originLocation = resolveJoin(row.origin_location);
  const customer = resolveJoin(row.customer);
  const sourceOrder = resolveJoin(row.source_order);
  const sourceQuotation = resolveJoin(row.source_quotation);

  return {
    id: row.id,
    invoice_number: row.invoice_number,
    customer_id: row.customer_id,
    customer_name: customer?.name ?? "",
    origin_location_id: row.origin_location_id,
    origin_location_name: originLocation?.name ?? "",
    origin_location_code: originLocation?.code ?? "",
    source_order_id: row.source_order_id,
    source_order_number: sourceOrder?.voucher_number ?? null,
    source_quotation_id: row.source_quotation_id,
    source_quotation_number: sourceQuotation?.quotation_number ?? null,
    commercial_status: row.commercial_status as SalesDocumentStatus,
    invoice_payment_status: row.invoice_payment_status as SalesPaymentStatus,
    billing_state: row.billing_state ?? "",
    shipping_state: row.shipping_state ?? "",
    payment_terms_days: Number(row.payment_terms_days) || 0,
    total_gross_amount: formatDecimal(row.total_gross_amount),
    total_tax_amount: formatDecimal(row.total_tax_amount ?? 0),
    total_net_amount: formatDecimal(row.total_net_amount),
    total_paid_amount: formatDecimal(row.total_paid_amount ?? 0),
    line_count: row.invoice_lines?.length ?? 0,
    customer_tax_treatment: (customer?.tax_treatment as TaxTreatmentType | null) ?? null,
    custom_fields: row.custom_fields ?? {},
    created_by: row.created_by,
    created_by_name: "",
    approval_submitted_by: null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const INVOICE_LIST_SELECT = `
  id,
  invoice_number,
  customer_id,
  origin_location_id,
  source_order_id,
  source_quotation_id,
  commercial_status,
  invoice_payment_status,
  billing_state,
  shipping_state,
  payment_terms_days,
  total_gross_amount,
  total_tax_amount,
  total_net_amount,
  total_paid_amount,
  custom_fields,
  created_by,
  created_at,
  updated_at,
  ${ORIGIN_LOCATION_EMBED} (name, code),
  ${CUSTOMER_EMBED} (name, tax_treatment),
  ${SOURCE_ORDER_EMBED} (voucher_number),
  ${SOURCE_QUOTATION_EMBED} (quotation_number),
  ${INVOICE_ITEMS_EMBED} (id)
`;

const INVOICE_DETAIL_SELECT = `
  id,
  invoice_number,
  customer_id,
  origin_location_id,
  source_order_id,
  source_quotation_id,
  commercial_status,
  invoice_payment_status,
  billing_state,
  shipping_state,
  payment_terms_days,
  total_gross_amount,
  total_tax_amount,
  total_net_amount,
  total_paid_amount,
  custom_fields,
  created_by,
  created_at,
  updated_at,
  ${ORIGIN_LOCATION_EMBED} (name, code),
  ${CUSTOMER_EMBED} (name, tax_treatment),
  ${SOURCE_ORDER_EMBED} (voucher_number),
  ${SOURCE_QUOTATION_EMBED} (quotation_number),
  ${INVOICE_ITEMS_EMBED} (
    id,
    item_id,
    variant_id,
    source_order_line_id,
    source_quotation_line_id,
    quantity_invoiced,
    unit_price_selling,
    discount_percentage,
    discount_amount,
    line_tax_amount,
    line_total_net,
    uom_code,
    uom_conversion_factor,
    items!sales_invoice_items_item_tenant_fk (name, base_unit_of_measure),
    item_variants!sales_invoice_items_variant_tenant_fk (sku)
  )
`;

export async function fetchSalesInvoices(
  supabase: SupabaseClient,
  tenantId: string,
  options?: { status?: SalesDocumentStatus | null }
): Promise<SalesInvoiceRow[]> {
  let query = supabase
    .from("sales_invoices")
    .select(INVOICE_LIST_SELECT)
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false });

  if (options?.status) {
    query = query.eq("commercial_status", options.status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((row) => mapInvoiceListRow(row as InvoiceListDbRow));
  await Promise.all([
    hydrateInvoiceCreatorNames(supabase, rows),
    hydrateInvoiceApprovalSubmitters(supabase, tenantId, rows),
  ]);
  return rows;
}

export async function fetchSalesInvoiceById(
  supabase: SupabaseClient,
  tenantId: string,
  salesInvoiceId: string
): Promise<SalesInvoiceRow | null> {
  const { data, error } = await supabase
    .from("sales_invoices")
    .select(INVOICE_DETAIL_SELECT)
    .eq("tenant_id", tenantId)
    .eq("id", salesInvoiceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as InvoiceListDbRow & { invoice_lines?: InvoiceLineDbRow[] | null };
  const mapped = mapInvoiceListRow(row);
  mapped.lines = (row.invoice_lines ?? []).map(mapInvoiceLine);
  await Promise.all([
    hydrateInvoiceCreatorNames(supabase, [mapped]),
    hydrateInvoiceApprovalSubmitters(supabase, tenantId, [mapped]),
  ]);
  return mapped;
}

export async function fetchOpenSalesInvoicesForCustomer(
  supabase: SupabaseClient,
  tenantId: string,
  customerId: string
): Promise<OpenSalesInvoiceOption[]> {
  const { data, error } = await supabase
    .from("sales_invoices")
    .select(
      `id, invoice_number, customer_id, total_net_amount, total_paid_amount,
       customer:entities!sales_invoices_customer_tenant_fk (name)`
    )
    .eq("tenant_id", tenantId)
    .eq("customer_id", customerId)
    .eq("commercial_status", "APPROVED_ACTIVE")
    .in("invoice_payment_status", ["UNPAID", "PARTIALLY_PAID"])
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row) => {
      const customer = resolveJoin(
        row.customer as { name: string } | { name: string }[] | null
      );
      const net = Number(row.total_net_amount);
      const paid = Number(row.total_paid_amount ?? 0);
      const outstanding = net - paid;
      if (!Number.isFinite(outstanding) || outstanding <= 0) return null;

      return {
        id: row.id as string,
        invoice_number: row.invoice_number as string,
        customer_id: row.customer_id as string,
        customer_name: customer?.name ?? "",
        total_net_amount: formatDecimal(row.total_net_amount),
        total_paid_amount: formatDecimal(row.total_paid_amount ?? 0),
        outstanding_amount: String(outstanding),
      };
    })
    .filter((row): row is OpenSalesInvoiceOption => row !== null);
}

export async function fetchInvoicePaymentApplications(
  supabase: SupabaseClient,
  tenantId: string,
  salesInvoiceId: string
): Promise<InvoicePaymentApplicationRow[]> {
  const { data, error } = await supabase
    .from("payment_applications")
    .select(
      `id, amount_applied, created_at,
       customer_payment:customer_payments!payment_applications_payment_tenant_fk (
         payment_number, payment_method, reference_number
       )`
    )
    .eq("tenant_id", tenantId)
    .eq("sales_invoice_id", salesInvoiceId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const payment = resolveJoin(
      row.customer_payment as
        | { payment_number: string; payment_method: string; reference_number: string | null }
        | Array<{ payment_number: string; payment_method: string; reference_number: string | null }>
        | null
    );
    return {
      id: row.id as string,
      amount_applied: formatDecimal(row.amount_applied),
      applied_at: row.created_at as string,
      payment_number: payment?.payment_number ?? "",
      payment_method: payment?.payment_method ?? "",
      reference_number: payment?.reference_number ?? null,
    };
  });
}
