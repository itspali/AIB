import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CustomerPaymentRow,
  GatewayProviderType,
  PaymentApplicationRow,
} from "@/lib/sales/payments/types";

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

async function hydratePaymentCreatorNames(
  supabase: SupabaseClient,
  rows: CustomerPaymentRow[]
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

type PaymentListDbRow = {
  id: string;
  payment_number: string;
  customer_id: string;
  amount_received: number | string;
  payment_method: string;
  currency_code: string;
  reference_number: string | null;
  received_at: string;
  created_by: string;
  created_at: string;
  customer: { name: string } | { name: string }[] | null;
  payment_applications: Array<{ amount_applied: number | string }> | null;
};

function mapPaymentListRow(row: PaymentListDbRow): CustomerPaymentRow {
  const customer = resolveJoin(row.customer);
  const appliedTotal = (row.payment_applications ?? []).reduce(
    (sum, app) => sum + Number(app.amount_applied ?? 0),
    0
  );
  const received = Number(row.amount_received);

  return {
    id: row.id,
    payment_number: row.payment_number,
    customer_id: row.customer_id,
    customer_name: customer?.name ?? "",
    amount_received: formatDecimal(row.amount_received),
    amount_applied: formatDecimal(appliedTotal),
    unapplied_balance: formatDecimal(received - appliedTotal),
    payment_method: row.payment_method as GatewayProviderType,
    currency_code: row.currency_code,
    reference_number: row.reference_number,
    received_at: row.received_at,
    created_by: row.created_by,
    created_by_name: "",
    created_at: row.created_at,
  };
}

const PAYMENT_LIST_SELECT = `
  id,
  payment_number,
  customer_id,
  amount_received,
  payment_method,
  currency_code,
  reference_number,
  received_at,
  created_by,
  created_at,
  customer:entities!customer_payments_customer_tenant_fk (name),
  payment_applications:payment_applications!payment_applications_payment_tenant_fk (amount_applied)
`;

const PAYMENT_DETAIL_SELECT = `
  id,
  payment_number,
  customer_id,
  amount_received,
  payment_method,
  currency_code,
  reference_number,
  received_at,
  created_by,
  created_at,
  customer:entities!customer_payments_customer_tenant_fk (name),
  payment_applications:payment_applications!payment_applications_payment_tenant_fk (
    id,
    sales_invoice_id,
    amount_applied,
    created_at,
    sales_invoice:sales_invoices!payment_applications_invoice_tenant_fk (invoice_number)
  )
`;

export async function fetchCustomerPayments(
  supabase: SupabaseClient,
  tenantId: string,
  options?: { customerId?: string | null }
): Promise<CustomerPaymentRow[]> {
  let query = supabase
    .from("customer_payments")
    .select(PAYMENT_LIST_SELECT)
    .eq("tenant_id", tenantId)
    .order("received_at", { ascending: false });

  if (options?.customerId) {
    query = query.eq("customer_id", options.customerId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((row) => mapPaymentListRow(row as PaymentListDbRow));
  await hydratePaymentCreatorNames(supabase, rows);
  return rows;
}

export async function fetchCustomerPaymentById(
  supabase: SupabaseClient,
  tenantId: string,
  paymentId: string
): Promise<CustomerPaymentRow | null> {
  const { data, error } = await supabase
    .from("customer_payments")
    .select(PAYMENT_DETAIL_SELECT)
    .eq("tenant_id", tenantId)
    .eq("id", paymentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const mapped = mapPaymentListRow(data as PaymentListDbRow);
  mapped.applications = (data.payment_applications ?? []).map((row) => {
    const typed = row as {
      id: string;
      sales_invoice_id: string;
      amount_applied: number | string;
      created_at: string;
      sales_invoice: { invoice_number: string } | { invoice_number: string }[] | null;
    };
    const invoice = resolveJoin(typed.sales_invoice);
    return {
      id: typed.id,
      sales_invoice_id: typed.sales_invoice_id,
      invoice_number: invoice?.invoice_number ?? "",
      amount_applied: formatDecimal(typed.amount_applied),
      applied_at: typed.created_at,
    } satisfies PaymentApplicationRow;
  });

  await hydratePaymentCreatorNames(supabase, [mapped]);
  return mapped;
}
