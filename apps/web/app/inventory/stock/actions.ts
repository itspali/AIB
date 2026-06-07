"use server";

import { revalidatePath } from "next/cache";
import {
  fetchStockAdjustmentById,
  fetchStockAdjustments,
  fetchStockBalances,
  fetchStockLocations,
  resolveVariantBySku,
} from "@/lib/inventory/stock/queries";
import { postStockAdjustmentSchema } from "@/lib/inventory/stock/schemas";
import type {
  StockAdjustmentRow,
  StockBalanceRow,
  StockLocationOption,
} from "@/lib/inventory/stock/types";
import { formatRpcDeployError, isMissingRpcError } from "@/lib/supabase/rpc-error";
import { requireTenantId } from "@/lib/supabase/require-tenant";

const STOCK_PATHS = ["/inventory/stock", "/inventory", "/items"] as const;

function revalidateStockPaths() {
  for (const path of STOCK_PATHS) {
    revalidatePath(path);
  }
}

export async function loadStockLocations(): Promise<StockLocationOption[]> {
  const { supabase, tenantId } = await requireTenantId();
  return fetchStockLocations(supabase, tenantId);
}

export async function loadStockBalances(options?: {
  locationId?: string | null;
  search?: string;
}): Promise<StockBalanceRow[]> {
  const { supabase, tenantId } = await requireTenantId();
  return fetchStockBalances(supabase, tenantId, options);
}

export async function loadStockAdjustments(options?: {
  locationId?: string | null;
  search?: string;
}): Promise<StockAdjustmentRow[]> {
  const { supabase, tenantId } = await requireTenantId();
  return fetchStockAdjustments(supabase, tenantId, options);
}

export async function loadStockAdjustmentDetail(
  adjustmentId: string
): Promise<{ adjustment: StockAdjustmentRow } | { error: string }> {
  if (!adjustmentId.trim()) return { error: "Adjustment id is required." };
  const { supabase, tenantId } = await requireTenantId();
  const adjustment = await fetchStockAdjustmentById(supabase, tenantId, adjustmentId);
  if (!adjustment) return { error: "Adjustment not found." };
  return { adjustment };
}

export async function lookupStockVariantBySku(sku: string) {
  const { supabase, tenantId } = await requireTenantId();
  const resolved = await resolveVariantBySku(supabase, tenantId, sku);
  if (!resolved) return { error: "No active variant found for that SKU." };
  if (!resolved.track_inventory) {
    return { error: "That item does not track inventory." };
  }
  if (resolved.tracking_mode !== "NONE") {
    return { error: "Lot and serial tracking are not supported in stock adjustments yet." };
  }
  return { variant: resolved };
}

export async function postStockAdjustment(raw: unknown) {
  const parsed = postStockAdjustmentSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid adjustment." };
  }

  const values = parsed.data;
  const { supabase, tenantId, userId } = await requireTenantId();

  const { data, error } = await supabase.rpc("post_stock_adjustment", {
    p_location_id: values.location_id,
    p_kind: values.kind,
    p_reason: values.reason,
    p_notes: values.notes?.trim() || null,
    p_lines: values.lines.map((line) => ({
      variant_id: line.variant_id,
      quantity_delta: Number(line.quantity_delta),
      unit_cost: Number(line.unit_cost || 0),
      line_notes: line.line_notes?.trim() || null,
    })),
    p_created_by: userId,
    p_source_system: null,
    p_source_document_id: null,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("post_stock_adjustment") };
    }
    if (error.message.toLowerCase().includes("document sequence not configured")) {
      return {
        error:
          "Document numbering is not configured for stock adjustments at this location. Add a STOCK_ADJUSTMENT prefix under Settings → Locations.",
      };
    }
    return { error: error.message };
  }

  revalidateStockPaths();
  return { success: true as const, adjustmentId: data as string };
}
