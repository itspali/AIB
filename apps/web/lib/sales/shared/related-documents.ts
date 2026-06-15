import type { SupabaseClient } from "@supabase/supabase-js";

export type SalesDocumentLinkSummary = {
  id: string;
  number: string;
};

export async function fetchInvoicesForSalesOrder(
  supabase: SupabaseClient,
  tenantId: string,
  salesOrderId: string
): Promise<SalesDocumentLinkSummary[]> {
  const { data, error } = await supabase
    .from("sales_invoices")
    .select("id, invoice_number")
    .eq("tenant_id", tenantId)
    .eq("source_order_id", salesOrderId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    number: row.invoice_number as string,
  }));
}
