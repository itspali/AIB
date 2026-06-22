"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  fetchGitHoldingLocations,
  fetchGoodsInTransitVoucherById,
  fetchGoodsInTransitVouchers,
} from "@/lib/procurement/git/queries";
import type { GoodsInTransitRow } from "@/lib/procurement/git/types";
import { fetchProcurementLocations } from "@/lib/procurement/shared/queries";
import { fetchReceivablePurchaseOrders } from "@/lib/procurement/purchase-orders/queries";
import type { ReceivablePurchaseOrderOption } from "@/lib/procurement/purchase-orders/types";
import { formatRpcDeployError, isMissingRpcError } from "@/lib/supabase/rpc-error";
import { requireTenantMutation } from "@/lib/supabase/require-tenant";

const GIT_PATHS = [
  "/procurement/goods-in-transit",
  "/procurement/goods-receipts",
  "/procurement",
  "/inventory/stock",
] as const;

const gitLineSchema = z.object({
  variant_id: z.string().uuid(),
  po_item_id: z.string().uuid().optional().nullable(),
  quantity: z.string().trim().min(1),
  unit_cost: z.string().trim().optional().default("0"),
});

const postGitSchema = z.object({
  source_location_id: z.string().uuid(),
  git_holding_location_id: z.string().uuid(),
  purchase_order_id: z.string().uuid().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  lines: z.array(gitLineSchema).min(1),
});

function revalidateGitPaths() {
  for (const path of GIT_PATHS) revalidatePath(path);
}

export async function loadGoodsInTransitVouchers(): Promise<GoodsInTransitRow[]> {
  const { supabase, tenantId } = await requireTenantMutation();
  return fetchGoodsInTransitVouchers(supabase, tenantId);
}

export async function loadGoodsInTransitDetail(
  voucherId: string
): Promise<{ voucher: GoodsInTransitRow } | { error: string }> {
  if (!voucherId.trim()) return { error: "Voucher id is required." };
  const { supabase, tenantId } = await requireTenantMutation();
  const voucher = await fetchGoodsInTransitVoucherById(supabase, tenantId, voucherId);
  if (!voucher) return { error: "GIT voucher not found." };
  return { voucher };
}

export async function loadGitCatalogContext(): Promise<{
  vouchers: GoodsInTransitRow[];
  sourceLocations: Awaited<ReturnType<typeof fetchProcurementLocations>>;
  gitLocations: Awaited<ReturnType<typeof fetchGitHoldingLocations>>;
  receivableOrders: ReceivablePurchaseOrderOption[];
}> {
  const { supabase, tenantId } = await requireTenantMutation();
  const [vouchers, sourceLocations, gitLocations, receivableOrders] = await Promise.all([
    fetchGoodsInTransitVouchers(supabase, tenantId),
    fetchProcurementLocations(supabase, tenantId),
    fetchGitHoldingLocations(supabase, tenantId),
    fetchReceivablePurchaseOrders(supabase, tenantId),
  ]);
  return { vouchers, sourceLocations, gitLocations, receivableOrders };
}

export async function postGoodsInTransit(raw: unknown) {
  const parsed = postGitSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid GIT voucher." };
  }

  const values = parsed.data;
  const { supabase, userId } = await requireTenantMutation();

  const { data, error } = await supabase.rpc("post_goods_in_transit", {
    p_source_location_id: values.source_location_id,
    p_git_holding_location_id: values.git_holding_location_id,
    p_lines: values.lines.map((line) => ({
      variant_id: line.variant_id,
      po_item_id: line.po_item_id ?? null,
      quantity: Number(line.quantity),
      unit_cost: Number(line.unit_cost || 0),
    })),
    p_created_by: userId,
    p_purchase_order_id: values.purchase_order_id ?? null,
    p_notes: values.notes?.trim() || null,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("post_goods_in_transit") };
    }
    return { error: error.message };
  }

  revalidateGitPaths();
  const payload = data as { voucher_id?: string; voucher_number?: string };
  return {
    success: true as const,
    voucherId: payload.voucher_id ?? "",
    voucherNumber: payload.voucher_number ?? "",
  };
}

export async function loadOpenGitVouchersForPo(
  purchaseOrderId: string
): Promise<GoodsInTransitRow[]> {
  if (!purchaseOrderId.trim()) return [];
  const { supabase, tenantId } = await requireTenantMutation();
  return fetchGoodsInTransitVouchers(supabase, tenantId, {
    purchaseOrderId,
    status: "POSTED",
  });
}
