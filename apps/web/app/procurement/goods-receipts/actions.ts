"use server";

import { revalidatePath } from "next/cache";
import { fetchGoodsReceiptById, fetchGoodsReceipts } from "@/lib/procurement/goods-receipts/queries";
import { formatGoodsReceiptRpcError } from "@/lib/procurement/goods-receipts/rpc-errors";
import { validateGrnLinesAgainstOpenQty } from "@/lib/procurement/goods-receipts/schemas";
import { validateGrnAcceptRejectLines } from "@/lib/procurement/goods-receipts/grn-line-validation";
import { postGoodsReceiptSchema } from "@/lib/procurement/goods-receipts/schemas";
import type { GoodsReceiptRow } from "@/lib/procurement/goods-receipts/types";
import { fetchReceivablePurchaseOrders } from "@/lib/procurement/purchase-orders/queries";
import type { ReceivablePurchaseOrderOption } from "@/lib/procurement/purchase-orders/types";
import { fetchProcurementLocationLabel } from "@/lib/procurement/shared/queries";
import {
  lookupStockVariantBySku,
  searchStockVariantsForAdjustment,
} from "@/app/inventory/stock/actions";
import {
  fetchLatestDocumentPostingRun,
  parsePostGoodsReceiptRpcResult,
} from "@/lib/documents/posting-queries";
import type { PostingStepResult } from "@/lib/documents/posting-types";
import { formatRpcDeployError, isMissingRpcError } from "@/lib/supabase/rpc-error";
import { requireTenantId } from "@/lib/supabase/require-tenant";

const GRN_PATHS = [
  "/procurement/goods-receipts",
  "/procurement/purchase-orders",
  "/procurement",
  "/inventory/stock",
  "/inventory",
] as const;

function revalidateGoodsReceiptPaths() {
  for (const path of GRN_PATHS) {
    revalidatePath(path);
  }
}

export async function loadGoodsReceipts(): Promise<GoodsReceiptRow[]> {
  const { supabase, tenantId } = await requireTenantId();
  return fetchGoodsReceipts(supabase, tenantId);
}

export async function loadGoodsReceiptDetail(
  goodsReceiptId: string
): Promise<{ goodsReceipt: GoodsReceiptRow } | { error: string }> {
  if (!goodsReceiptId.trim()) return { error: "Goods receipt id is required." };
  const { supabase, tenantId } = await requireTenantId();
  const goodsReceipt = await fetchGoodsReceiptById(supabase, tenantId, goodsReceiptId);
  if (!goodsReceipt) return { error: "Goods receipt not found." };
  return { goodsReceipt };
}

export async function loadReceivablePurchaseOrders(
  locationId?: string | null
): Promise<ReceivablePurchaseOrderOption[]> {
  const { supabase, tenantId } = await requireTenantId();
  return fetchReceivablePurchaseOrders(supabase, tenantId, {
    locationId: locationId ?? null,
  });
}

export { searchStockVariantsForAdjustment, lookupStockVariantBySku };

export async function postGoodsReceipt(
  raw: unknown,
  openQtyByPoItemId?: Record<string, string>
) {
  const parsed = postGoodsReceiptSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid goods receipt." };
  }

  const values = parsed.data;

  if (openQtyByPoItemId) {
    const qtyError = validateGrnLinesAgainstOpenQty(values.lines, openQtyByPoItemId);
    if (qtyError) return { error: qtyError };
  }

  const acceptRejectError = validateGrnAcceptRejectLines(
    values.lines.map((line) => ({
      variant_sku: line.variant_id,
      quantity_received: line.quantity_received,
      quantity_accepted: line.quantity_accepted?.trim() || line.quantity_received,
      quantity_rejected: line.quantity_rejected?.trim() || "0",
    }))
  );
  if (acceptRejectError) return { error: acceptRejectError };

  const { supabase, tenantId, userId } = await requireTenantId();

  const rpcLines = values.lines.map((line) => {
    const received = Number(line.quantity_received);
    const acceptedRaw = line.quantity_accepted?.trim();
    const accepted = acceptedRaw ? Number(acceptedRaw) : received;
    const rejected = Number(line.quantity_rejected?.trim() || "0");
    return {
      variant_id: line.variant_id,
      po_item_id: line.po_item_id ?? null,
      quantity_received: received,
      quantity_accepted: accepted,
      quantity_rejected: rejected,
      raw_unit_cost: Number(line.raw_unit_cost),
      is_promotional: line.is_promotional ?? false,
    };
  });

  if (values.git_voucher_id) {
    const { error: gitError } = await supabase.rpc("clear_goods_in_transit_for_grn", {
      p_git_voucher_id: values.git_voucher_id,
      p_destination_location_id: values.destination_location_id,
      p_lines: rpcLines.map((line) => ({
        variant_id: line.variant_id,
        quantity_received: line.quantity_received,
        quantity_accepted: line.quantity_accepted,
      })),
      p_created_by: userId,
    });

    if (gitError) {
      if (isMissingRpcError(gitError)) {
        return { error: formatRpcDeployError("clear_goods_in_transit_for_grn") };
      }
      return { error: gitError.message };
    }
  }

  const { data, error } = await supabase.rpc("post_goods_receipt", {
    p_destination_location_id: values.destination_location_id,
    p_purchase_order_id: values.purchase_order_id ?? null,
    p_lines: rpcLines,
    p_created_by: userId,
    p_bill_of_entry_number: values.bill_of_entry_number ?? null,
    p_bill_of_entry_date: values.bill_of_entry_date || null,
    p_port_code: values.port_code ?? null,
    p_exchange_rate: values.exchange_rate ? Number(values.exchange_rate) : null,
    p_assessable_value: values.assessable_value ? Number(values.assessable_value) : null,
    p_customs_duty_amount: values.customs_duty_amount ? Number(values.customs_duty_amount) : null,
    p_import_igst_amount: values.import_igst_amount ? Number(values.import_igst_amount) : null,
    p_landed_charges: (values.landed_charges ?? []).map((charge) => ({
      charge_type: charge.charge_type,
      amount: Number(charge.amount),
      allocation_method: charge.allocation_method ?? null,
    })),
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("post_goods_receipt") };
    }

    const locationMeta = await fetchProcurementLocationLabel(
      supabase,
      tenantId,
      values.destination_location_id
    );

    const formatted = formatGoodsReceiptRpcError(error.message, {
      locationId: values.destination_location_id,
      locationName: locationMeta?.locationName,
      locationCode: locationMeta?.locationCode,
    });

    return {
      error: formatted.message,
      errorAction: formatted.action,
    };
  }

  const parsedResult = parsePostGoodsReceiptRpcResult(data);
  if (!parsedResult) {
    return { error: "Goods receipt posted but the response was invalid." };
  }

  if (values.purchase_order_id) {
    const { error: backflushError } = await supabase.rpc("apply_subcontract_backflush_for_grn", {
      p_goods_receipt_id: parsedResult.goodsReceiptId,
    });
    if (backflushError && !isMissingRpcError(backflushError)) {
      return {
        error: `Receipt posted but subcontract backflush failed: ${backflushError.message}`,
      };
    }
  }

  revalidateGoodsReceiptPaths();
  return {
    success: true as const,
    goodsReceiptId: parsedResult.goodsReceiptId,
    steps: parsedResult.steps,
  };
}

export async function loadGoodsReceiptPostingRun(goodsReceiptId: string): Promise<{
  steps: PostingStepResult[];
  postedAt: string | null;
} | null> {
  if (!goodsReceiptId.trim()) return null;
  const { supabase } = await requireTenantId();
  const run = await fetchLatestDocumentPostingRun(supabase, "GRN", goodsReceiptId);
  if (!run) return null;
  return { steps: run.steps, postedAt: run.posted_at || null };
}

export async function releaseGoodsReceiptFromQc(goodsReceiptId: string) {
  if (!goodsReceiptId.trim()) return { error: "Goods receipt id is required." };

  const { supabase, userId } = await requireTenantId();
  const { data, error } = await supabase.rpc("release_goods_receipt_from_qc", {
    p_goods_receipt_id: goodsReceiptId,
    p_released_by: userId,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("release_goods_receipt_from_qc") };
    }
    return { error: error.message };
  }

  const postingRun = await fetchLatestDocumentPostingRun(supabase, "GRN", goodsReceiptId);
  revalidateGoodsReceiptPaths();

  return {
    success: true as const,
    steps: postingRun?.steps ?? [],
    detail: data,
  };
}
