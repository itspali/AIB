"use server";

import { revalidatePath } from "next/cache";
import {
  fetchStockTransferById,
  fetchStockTransfers,
  fetchStockTransfersPage,
  fetchTransferLocationLabel,
  fetchTransferLocations,
} from "@/lib/inventory/transfers/queries";
import { formatStockTransferRpcError } from "@/lib/inventory/transfers/rpc-errors";
import {
  receiveStockTransferSchema,
  saveStockTransferSchema,
} from "@/lib/inventory/transfers/schemas";
import type { StockTransferRow, TransferLocationOption } from "@/lib/inventory/transfers/types";
import {
  lookupStockVariantBySku,
  searchStockVariantsForAdjustment,
} from "@/app/inventory/stock/actions";
import { formatRpcDeployError, isMissingRpcError } from "@/lib/supabase/rpc-error";
import { requireTenantId } from "@/lib/supabase/require-tenant";

const TRANSFER_PATHS = ["/inventory/transfers", "/inventory", "/inventory/stock"] as const;

function revalidateTransferPaths() {
  for (const path of TRANSFER_PATHS) {
    revalidatePath(path);
  }
}

function parseOptionalCost(value: string | undefined): number {
  if (!value?.trim()) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

async function formatTransferError(
  message: string,
  sourceLocationId?: string,
  destinationLocationId?: string
) {
  const { supabase, tenantId } = await requireTenantId();
  const [sourceMeta, destinationMeta] = await Promise.all([
    sourceLocationId
      ? fetchTransferLocationLabel(supabase, tenantId, sourceLocationId)
      : Promise.resolve(null),
    destinationLocationId
      ? fetchTransferLocationLabel(supabase, tenantId, destinationLocationId)
      : Promise.resolve(null),
  ]);

  return formatStockTransferRpcError(message, {
    sourceLocationId,
    sourceLocationName: sourceMeta?.locationName,
    sourceLocationCode: sourceMeta?.locationCode,
    destinationLocationId,
    destinationLocationName: destinationMeta?.locationName,
    destinationLocationCode: destinationMeta?.locationCode,
  });
}

export async function loadTransferLocations(): Promise<TransferLocationOption[]> {
  const { supabase, tenantId } = await requireTenantId();
  return fetchTransferLocations(supabase, tenantId);
}

export async function fetchMoreStockTransfers(offset: number) {
  const { supabase, tenantId } = await requireTenantId();
  return fetchStockTransfersPage(supabase, tenantId, { offset });
}

export async function loadStockTransfers(): Promise<StockTransferRow[]> {
  const { supabase, tenantId } = await requireTenantId();
  const page = await fetchStockTransfersPage(supabase, tenantId);
  return page.rows;
}

export async function loadStockTransferDetail(
  transferId: string
): Promise<{ transfer: StockTransferRow } | { error: string }> {
  if (!transferId.trim()) return { error: "Transfer id is required." };
  const { supabase, tenantId } = await requireTenantId();
  const transfer = await fetchStockTransferById(supabase, tenantId, transferId);
  if (!transfer) return { error: "Transfer not found." };
  return { transfer };
}

export { searchStockVariantsForAdjustment, lookupStockVariantBySku };

export async function saveStockTransfer(raw: unknown) {
  const parsed = saveStockTransferSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid transfer." };
  }

  const values = parsed.data;
  const { supabase, tenantId, userId } = await requireTenantId();

  const { data, error } = await supabase.rpc("save_stock_transfer", {
    p_transfer_id: values.transfer_id ?? null,
    p_source_location_id: values.source_location_id,
    p_destination_location_id: values.destination_location_id,
    p_lines: values.lines.map((line) => ({
      variant_id: line.variant_id,
      quantity_dispatched: Number(line.quantity_dispatched),
    })),
    p_created_by: userId,
    p_inter_company_freight_cost: parseOptionalCost(values.inter_company_freight_cost),
    p_loading_overhead_cost: parseOptionalCost(values.loading_overhead_cost),
    p_unloading_overhead_cost: parseOptionalCost(values.unloading_overhead_cost),
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("save_stock_transfer") };
    }

    const formatted = await formatTransferError(
      error.message,
      values.source_location_id,
      values.destination_location_id
    );

    return {
      error: formatted.message,
      errorAction: formatted.action,
    };
  }

  revalidateTransferPaths();
  return { success: true as const, transferId: data as string };
}

export async function dispatchStockTransfer(transferId: string) {
  if (!transferId.trim()) return { error: "Transfer id is required." };

  const { supabase } = await requireTenantId();
  const detail = await loadStockTransferDetail(transferId);
  if ("error" in detail) return { error: detail.error };

  const { data, error } = await supabase.rpc("dispatch_stock_transfer", {
    p_transfer_id: transferId,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("dispatch_stock_transfer") };
    }

    const formatted = await formatTransferError(
      error.message,
      detail.transfer.source_location_id,
      detail.transfer.destination_location_id
    );

    return {
      error: formatted.message,
      errorAction: formatted.action,
    };
  }

  revalidateTransferPaths();
  return { success: true as const, transferId: data as string };
}

export async function receiveStockTransfer(raw: unknown) {
  const parsed = receiveStockTransferSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid receipt." };
  }

  const values = parsed.data;
  const { supabase } = await requireTenantId();
  const detail = await loadStockTransferDetail(values.transfer_id);
  if ("error" in detail) return { error: detail.error };

  const { data, error } = await supabase.rpc("receive_stock_transfer", {
    p_transfer_id: values.transfer_id,
    p_lines: values.lines.map((line) => ({
      line_id: line.line_id,
      quantity_accepted: Number(line.quantity_accepted || 0),
      quantity_damaged: Number(line.quantity_damaged || 0),
      quantity_lost: Number(line.quantity_lost || 0),
    })),
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("receive_stock_transfer") };
    }

    const formatted = await formatTransferError(
      error.message,
      detail.transfer.source_location_id,
      detail.transfer.destination_location_id
    );

    return {
      error: formatted.message,
      errorAction: formatted.action,
    };
  }

  revalidateTransferPaths();
  return { success: true as const, transferId: data as string };
}

export async function cancelStockTransfer(transferId: string) {
  if (!transferId.trim()) return { error: "Transfer id is required." };

  const { supabase } = await requireTenantId();

  const { data, error } = await supabase.rpc("cancel_stock_transfer", {
    p_transfer_id: transferId,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("cancel_stock_transfer") };
    }
    return { error: error.message };
  }

  revalidateTransferPaths();
  return { success: true as const, transferId: data as string };
}
