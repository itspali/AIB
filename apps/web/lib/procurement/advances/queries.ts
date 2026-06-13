import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BillAdvanceApplicationRow,
  VendorAdvancePaymentRow,
} from "@/lib/procurement/advances/types";

export async function fetchVendorAdvancePayments(
  supabase: SupabaseClient,
  tenantId: string,
  options?: { supplierId?: string; withBalanceOnly?: boolean }
): Promise<VendorAdvancePaymentRow[]> {
  let query = supabase
    .from("vendor_advance_payments")
    .select(
      `
      id,
      supplier_id,
      payment_reference,
      amount,
      unapplied_balance,
      currency_code,
      payment_date,
      notes,
      created_at,
      entities (name)
    `
    )
    .eq("tenant_id", tenantId)
    .order("payment_date", { ascending: false });

  if (options?.supplierId) query = query.eq("supplier_id", options.supplierId);
  if (options?.withBalanceOnly) query = query.gt("unapplied_balance", 0);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const entity = Array.isArray(row.entities) ? row.entities[0] : row.entities;
    return {
      id: row.id as string,
      supplier_id: row.supplier_id as string,
      supplier_name: (entity?.name as string) ?? "",
      payment_reference: row.payment_reference as string,
      amount: String(row.amount ?? "0"),
      unapplied_balance: String(row.unapplied_balance ?? "0"),
      currency_code: row.currency_code as string,
      payment_date: row.payment_date as string,
      notes: (row.notes as string | null) ?? null,
      created_at: row.created_at as string,
    };
  });
}

export async function fetchBillAdvanceApplications(
  supabase: SupabaseClient,
  tenantId: string,
  purchaseInvoiceId: string
): Promise<BillAdvanceApplicationRow[]> {
  const { data, error } = await supabase
    .from("purchase_invoice_advance_applications")
    .select(
      `
      id,
      vendor_advance_payment_id,
      amount_applied,
      applied_at,
      vendor_advance_payments!inner (
        payment_reference
      )
    `
    )
    .eq("tenant_id", tenantId)
    .eq("purchase_invoice_id", purchaseInvoiceId)
    .order("applied_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const advance = Array.isArray(row.vendor_advance_payments)
      ? row.vendor_advance_payments[0]
      : row.vendor_advance_payments;
    return {
      id: row.id as string,
      vendor_advance_payment_id: row.vendor_advance_payment_id as string,
      payment_reference: (advance?.payment_reference as string) ?? "",
      amount_applied: String(row.amount_applied ?? "0"),
      applied_at: row.applied_at as string,
    };
  });
}
