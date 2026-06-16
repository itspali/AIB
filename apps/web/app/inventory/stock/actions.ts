"use server";

import { revalidatePath } from "next/cache";
import {
  fetchStockAdjustmentById,
  fetchStockAdjustments,
  fetchStockBalances,
  fetchStockLocationLabel,
  fetchStockLocations,
  listStockVariantsForBrowse,
  resolveVariantByScanCode,
  searchStockVariants,
} from "@/lib/inventory/stock/queries";
import { formatStockAdjustmentRpcError } from "@/lib/inventory/stock/rpc-errors";
import { postStockAdjustmentSchema } from "@/lib/inventory/stock/schemas";
import type {
  StockAdjustmentRow,
  StockBalanceRow,
  StockLocationOption,
  StockVariantOption,
} from "@/lib/inventory/stock/types";
import {
  DEFAULT_CATALOG_ITEM_SETTINGS,
  isScanIdentifierPolicy,
} from "@/lib/products/catalog-item-settings";
import { fetchPromoInventoryBalances } from "@/lib/inventory/stock/promo-balances";
import { fetchQcInventoryBalances } from "@/lib/inventory/stock/qc-balances";
import { fetchPromotionalReclassificationBatches } from "@/lib/procurement/promo/reclassification";
import type { PromotionalBatchRow } from "@/lib/procurement/promo/reclassification-helpers";
import type { PromoInventoryBalanceRow } from "@/lib/inventory/stock/promo-balances";
import type { QcInventoryBalanceRow } from "@/lib/inventory/stock/qc-balances";
import { fetchDocumentLineStockContexts } from "@/lib/inventory/stock/line-stock-context";
import type { DocumentLineStockContext } from "@/lib/inventory/stock/line-stock-context";
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

export async function loadDocumentLineStockContexts(input: {
  location_id: string;
  variant_ids: string[];
}): Promise<
  { contexts: Record<string, DocumentLineStockContext> } | { error: string }
> {
  const locationId = input.location_id.trim();
  const variantIds = input.variant_ids.map((id) => id.trim()).filter(Boolean);
  if (!locationId || variantIds.length === 0) {
    return { contexts: {} };
  }

  try {
    const { supabase, tenantId } = await requireTenantId();
    const contexts = await fetchDocumentLineStockContexts(supabase, tenantId, {
      location_id: locationId,
      variant_ids: variantIds,
    });
    return { contexts };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to load stock for line items.",
    };
  }
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

export async function searchStockVariantsForAdjustment(
  query: string
): Promise<{ variants: StockVariantOption[] } | { error: string }> {
  const trimmed = query.trim();
  if (trimmed.length < 1) return { variants: [] };

  try {
    const { supabase, tenantId } = await requireTenantId();
    const variants = await searchStockVariants(supabase, tenantId, trimmed);
    return { variants };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to search variants." };
  }
}

export async function listStockVariantsForAdjustmentBrowse(): Promise<
  { variants: StockVariantOption[] } | { error: string }
> {
  try {
    const { supabase, tenantId } = await requireTenantId();
    const variants = await listStockVariantsForBrowse(supabase, tenantId);
    return { variants };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to load variants.",
    };
  }
}

export async function lookupStockVariantBySku(sku: string) {
  const { supabase, tenantId } = await requireTenantId();

  const { data: tenantRow } = await supabase
    .from("tenants")
    .select("accounting_config")
    .eq("id", tenantId)
    .maybeSingle();

  const config = tenantRow?.accounting_config as Record<string, unknown> | null;
  const policyRaw = config?.scan_identifier_policy;
  const policy = isScanIdentifierPolicy(String(policyRaw ?? ""))
    ? (policyRaw as typeof DEFAULT_CATALOG_ITEM_SETTINGS.scan_identifier_policy)
    : DEFAULT_CATALOG_ITEM_SETTINGS.scan_identifier_policy;

  const resolved = await resolveVariantByScanCode(supabase, tenantId, sku, policy);
  if (!resolved) return { error: "No active variant found for that code." };
  if (resolved.blocked_reason) {
    return { error: resolved.blocked_reason };
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

    const locationMeta = await fetchStockLocationLabel(
      supabase,
      tenantId,
      values.location_id
    );

    const formatted = formatStockAdjustmentRpcError(error.message, {
      locationId: values.location_id,
      locationName: locationMeta?.locationName,
      locationCode: locationMeta?.locationCode,
    });

    return {
      error: formatted.message,
      errorAction: formatted.action,
    };
  }

  revalidateStockPaths();
  return { success: true as const, adjustmentId: data as string };
}

export async function loadPromoInventoryBalances(): Promise<PromoInventoryBalanceRow[]> {
  const { supabase, tenantId } = await requireTenantId();
  return fetchPromoInventoryBalances(supabase, tenantId);
}

export async function loadQcInventoryBalances(): Promise<QcInventoryBalanceRow[]> {
  const { supabase, tenantId } = await requireTenantId();
  return fetchQcInventoryBalances(supabase, tenantId);
}

export async function loadPromotionalReclassificationBatches(): Promise<PromotionalBatchRow[]> {
  const { supabase, tenantId } = await requireTenantId();
  return fetchPromotionalReclassificationBatches(supabase, tenantId, { status: "DRAFT" });
}

export async function createPromoReclassificationBatch(
  balanceIds: string[],
  notes: string | null
) {
  if (!balanceIds.length) {
    return { error: "Select at least one promotional balance." };
  }

  const { supabase, userId } = await requireTenantId();

  const { data, error } = await supabase.rpc("create_promotional_reclassification_batch", {
    p_balance_ids: balanceIds,
    p_created_by: userId,
    p_notes: notes,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("create_promotional_reclassification_batch") };
    }
    return { error: error.message };
  }

  revalidateStockPaths();
  const payload = data as { batch_id?: string; batch_number?: string };
  return {
    success: true as const,
    batchId: payload.batch_id ?? "",
    batchNumber: payload.batch_number ?? "",
  };
}

export async function postPromoReclassificationBatch(batchId: string) {
  if (!batchId.trim()) return { error: "Batch id is required." };

  const { supabase } = await requireTenantId();

  const { data, error } = await supabase.rpc("post_promotional_reclassification", {
    p_batch_id: batchId,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("post_promotional_reclassification") };
    }
    return { error: error.message };
  }

  revalidateStockPaths();
  const payload = data as { quantity_reclassified?: number | string };
  return {
    success: true as const,
    quantityReclassified: payload.quantity_reclassified ?? 0,
  };
}
