"use server";

import { revalidatePath } from "next/cache";
import { fetchGoodsReceiptById, fetchGoodsReceipts } from "@/lib/procurement/goods-receipts/queries";
import { formatGoodsReceiptRpcError } from "@/lib/procurement/goods-receipts/rpc-errors";
import {
  postGoodsReceiptSchema,
  validateGrnLinesAgainstOpenQty,
} from "@/lib/procurement/goods-receipts/schemas";
import type { GoodsReceiptRow } from "@/lib/procurement/goods-receipts/types";
import { fetchReceivablePurchaseOrders } from "@/lib/procurement/purchase-orders/queries";
import type { ReceivablePurchaseOrderOption } from "@/lib/procurement/purchase-orders/types";
import { fetchProcurementLocationLabel } from "@/lib/procurement/shared/queries";
import {
  lookupStockVariantBySku,
  searchStockVariantsForAdjustment,
} from "@/app/inventory/stock/actions";
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

  const { supabase, tenantId, userId } = await requireTenantId();

  const { data, error } = await supabase.rpc("post_goods_receipt", {
    p_destination_location_id: values.destination_location_id,
    p_purchase_order_id: values.purchase_order_id ?? null,
    p_lines: values.lines.map((line) => ({
      variant_id: line.variant_id,
      po_item_id: line.po_item_id ?? null,
      quantity_received: Number(line.quantity_received),
      raw_unit_cost: Number(line.raw_unit_cost),
    })),
    p_created_by: userId,
    p_bill_of_entry_number: values.bill_of_entry_number ?? null,
    p_bill_of_entry_date: values.bill_of_entry_date || null,
    p_port_code: values.port_code ?? null,
    p_exchange_rate: values.exchange_rate ? Number(values.exchange_rate) : null,
    p_assessable_value: values.assessable_value ? Number(values.assessable_value) : null,
    p_customs_duty_amount: values.customs_duty_amount ? Number(values.customs_duty_amount) : null,
    p_import_igst_amount: values.import_igst_amount ? Number(values.import_igst_amount) : null,
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

  revalidateGoodsReceiptPaths();
  return { success: true as const, goodsReceiptId: data as string };
}
