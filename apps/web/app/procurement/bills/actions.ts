"use server";

import { revalidatePath } from "next/cache";
import { fetchLatestDocumentPostingRun } from "@/lib/documents/posting-queries";
import {
  fetchPurchaseBillById,
  fetchPurchaseBills,
} from "@/lib/procurement/bills/queries";
import { savePurchaseBillSchema } from "@/lib/procurement/bills/schemas";
import type { PurchaseBillRow } from "@/lib/procurement/bills/types";
import { fetchGoodsReceiptsForPurchaseOrder } from "@/lib/procurement/goods-receipts/queries";
import { fetchBillablePurchaseOrders } from "@/lib/procurement/purchase-orders/queries";
import type { BillablePurchaseOrderOption } from "@/lib/procurement/purchase-orders/types";
import type { GoodsReceiptRow } from "@/lib/procurement/goods-receipts/types";
import type { PostingStepResult } from "@/lib/documents/posting-types";
import { formatRpcDeployError, isMissingRpcError } from "@/lib/supabase/rpc-error";
import { requireTenantId } from "@/lib/supabase/require-tenant";
import { z } from "zod";

const BILL_PATHS = ["/procurement/bills", "/procurement", "/dashboard"] as const;

function revalidateBillPaths() {
  for (const path of BILL_PATHS) {
    revalidatePath(path);
  }
}

export async function loadPurchaseBills(): Promise<PurchaseBillRow[]> {
  const { supabase, tenantId } = await requireTenantId();
  return fetchPurchaseBills(supabase, tenantId);
}

export async function loadBillablePurchaseOrders(
  supplierId?: string | null
): Promise<BillablePurchaseOrderOption[]> {
  const { supabase, tenantId } = await requireTenantId();
  return fetchBillablePurchaseOrders(supabase, tenantId, {
    supplierId: supplierId ?? null,
  });
}

export async function loadBillingGrnsForPo(
  purchaseOrderId: string
): Promise<{ grns: GoodsReceiptRow[] } | { error: string }> {
  const parsed = z.string().uuid().safeParse(purchaseOrderId);
  if (!parsed.success) return { error: "Invalid purchase order." };

  const { supabase, tenantId } = await requireTenantId();
  try {
    const grns = await fetchGoodsReceiptsForPurchaseOrder(supabase, tenantId, parsed.data);
    return { grns };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to load goods receipts.",
    };
  }
}

export async function loadPurchaseBillDetail(
  purchaseInvoiceId: string
): Promise<{ bill: PurchaseBillRow } | { error: string }> {
  const parsed = z.string().uuid().safeParse(purchaseInvoiceId);
  if (!parsed.success) return { error: "Invalid bill id." };

  const { supabase, tenantId } = await requireTenantId();
  try {
    const bill = await fetchPurchaseBillById(supabase, tenantId, parsed.data);
    if (!bill) return { error: "Bill not found." };
    return { bill };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to load bill detail.",
    };
  }
}

export async function savePurchaseBill(raw: unknown) {
  const parsed = savePurchaseBillSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid bill." };
  }

  const values = parsed.data;
  const { supabase, userId, tenantId } = await requireTenantId();

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
  const bill = await fetchPurchaseBillById(supabase, tenantId, invoiceId);

  revalidateBillPaths();
  return {
    success: true as const,
    purchaseInvoiceId: invoiceId,
    match_status: bill?.match_status ?? "MATCHED",
    steps: postingRun?.steps ?? ([] as PostingStepResult[]),
    overall: postingRun?.overall_status ?? "success",
  };
}

export async function applyPurchasePriceVariance(purchaseInvoiceId: string) {
  const parsed = z.string().uuid().safeParse(purchaseInvoiceId);
  if (!parsed.success) return { error: "Invalid bill id." };

  const { supabase } = await requireTenantId();
  const { data, error } = await supabase.rpc("apply_purchase_price_variance", {
    p_invoice_id: parsed.data,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("apply_purchase_price_variance") };
    }
    return { error: error.message };
  }

  const parsedResult =
    data && typeof data === "object"
      ? (data as { steps?: PostingStepResult[] })
      : null;
  const postingRun = await fetchLatestDocumentPostingRun(supabase, "BILL", parsed.data);

  revalidateBillPaths();
  return {
    success: true as const,
    steps: parsedResult?.steps ?? postingRun?.steps ?? ([] as PostingStepResult[]),
    overall: postingRun?.overall_status ?? "success",
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
