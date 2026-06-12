"use server";

import { revalidatePath } from "next/cache";
import { fetchLatestDocumentPostingRun } from "@/lib/documents/posting-queries";
import { fetchPurchaseBills } from "@/lib/procurement/bills/queries";
import { savePurchaseBillSchema } from "@/lib/procurement/bills/schemas";
import type { PurchaseBillRow } from "@/lib/procurement/bills/types";
import type { PostingStepResult } from "@/lib/documents/posting-types";
import { formatRpcDeployError, isMissingRpcError } from "@/lib/supabase/rpc-error";
import { requireTenantId } from "@/lib/supabase/require-tenant";

const BILL_PATHS = ["/procurement/bills", "/procurement", "/dashboard"] as const;

export async function loadPurchaseBills(): Promise<PurchaseBillRow[]> {
  const { supabase, tenantId } = await requireTenantId();
  return fetchPurchaseBills(supabase, tenantId);
}

export async function savePurchaseBill(raw: unknown) {
  const parsed = savePurchaseBillSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid bill." };
  }

  const values = parsed.data;
  const { supabase, userId } = await requireTenantId();

  const { data, error } = await supabase.rpc("save_purchase_invoice", {
    p_purchase_invoice_id: values.purchase_invoice_id ?? null,
    p_supplier_id: values.supplier_id,
    p_billing_location_id: values.billing_location_id,
    p_invoice_number_vendor: values.invoice_number_vendor,
    p_lines: values.lines.map((line) => ({
      variant_id: line.variant_id,
      purchase_order_item_id: line.purchase_order_item_id ?? null,
      quantity_billed: Number(line.quantity_billed),
      unit_price_billed: Number(line.unit_price_billed),
    })),
    p_created_by: userId,
    p_purchase_order_id: values.purchase_order_id ?? null,
    p_currency_code: values.currency_code ?? null,
    p_exchange_rate: values.exchange_rate ? Number(values.exchange_rate) : null,
    p_bill_of_entry_number: values.bill_of_entry_number ?? null,
    p_bill_of_entry_date: values.bill_of_entry_date || null,
    p_port_code: values.port_code ?? null,
    p_custom_fields: {},
    p_goods_receipt_ids:
      values.goods_receipt_ids && values.goods_receipt_ids.length > 0
        ? values.goods_receipt_ids
        : null,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("save_purchase_invoice") };
    }
    return { error: error.message };
  }

  const invoiceId = data as string;
  const postingRun = await fetchLatestDocumentPostingRun(supabase, "BILL", invoiceId);

  for (const path of BILL_PATHS) revalidatePath(path);
  return {
    success: true as const,
    purchaseInvoiceId: invoiceId,
    steps: postingRun?.steps ?? ([] as PostingStepResult[]),
  };
}

export async function exportGstrReport(
  periodStart: string,
  periodEnd: string,
  report: "GSTR1" | "GSTR2" | "GSTR3B" = "GSTR1"
) {
  const { supabase } = await requireTenantId();
  const { data, error } = await supabase.rpc("fetch_gstr_export", {
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_report: report,
  });
  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("fetch_gstr_export") };
    }
    return { error: error.message };
  }
  return { data };
}
