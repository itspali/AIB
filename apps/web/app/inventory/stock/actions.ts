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
