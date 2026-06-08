"use server";

import { revalidatePath } from "next/cache";
import {
  fetchPurchaseOrderById,
  fetchPurchaseOrders,
} from "@/lib/procurement/purchase-orders/queries";
import { formatPurchaseOrderRpcError } from "@/lib/procurement/purchase-orders/rpc-errors";
import {
  issuePurchaseOrderSchema,
  savePurchaseOrderSchema,
} from "@/lib/procurement/purchase-orders/schemas";
import type { PurchaseOrderRow } from "@/lib/procurement/purchase-orders/types";
import {
  fetchProcurementLocationLabel,
  fetchProcurementLocations,
  fetchProcurementSuppliers,
} from "@/lib/procurement/shared/queries";
import type {
  ProcurementLocationOption,
  ProcurementSupplierOption,
} from "@/lib/procurement/shared/types";
import {
  lookupStockVariantBySku,
  searchStockVariantsForAdjustment,
} from "@/app/inventory/stock/actions";
import { formatRpcDeployError, isMissingRpcError } from "@/lib/supabase/rpc-error";
import { requireTenantId } from "@/lib/supabase/require-tenant";

const PO_PATHS = [
  "/procurement/purchase-orders",
  "/procurement/goods-receipts",
  "/procurement",
] as const;

function revalidatePurchaseOrderPaths() {
  for (const path of PO_PATHS) {
    revalidatePath(path);
  }
}

export async function loadProcurementLocations(): Promise<ProcurementLocationOption[]> {
  const { supabase, tenantId } = await requireTenantId();
  return fetchProcurementLocations(supabase, tenantId);
}

export async function loadProcurementSuppliers(): Promise<ProcurementSupplierOption[]> {
  const { supabase, tenantId } = await requireTenantId();
  return fetchProcurementSuppliers(supabase, tenantId);
}

export async function loadPurchaseOrders(): Promise<PurchaseOrderRow[]> {
  const { supabase, tenantId } = await requireTenantId();
  return fetchPurchaseOrders(supabase, tenantId);
}

export async function loadPurchaseOrderDetail(
  purchaseOrderId: string
): Promise<{ purchaseOrder: PurchaseOrderRow } | { error: string }> {
  if (!purchaseOrderId.trim()) return { error: "Purchase order id is required." };
  const { supabase, tenantId } = await requireTenantId();
  const purchaseOrder = await fetchPurchaseOrderById(supabase, tenantId, purchaseOrderId);
  if (!purchaseOrder) return { error: "Purchase order not found." };
  return { purchaseOrder };
}

export { searchStockVariantsForAdjustment, lookupStockVariantBySku };

export async function savePurchaseOrder(raw: unknown) {
  const parsed = savePurchaseOrderSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid purchase order." };
  }

  const values = parsed.data;
  const { supabase, tenantId, userId } = await requireTenantId();

  const { data, error } = await supabase.rpc("save_purchase_order", {
    p_purchase_order_id: values.purchase_order_id ?? null,
    p_destination_location_id: values.destination_location_id,
    p_supplier_id: values.supplier_id,
    p_lines: values.lines.map((line) => ({
      variant_id: line.variant_id,
      quantity_ordered: Number(line.quantity_ordered),
      unit_price_contractual: Number(line.unit_price_contractual || 0),
    })),
    p_created_by: userId,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("save_purchase_order") };
    }

    const locationMeta = await fetchProcurementLocationLabel(
      supabase,
      tenantId,
      values.destination_location_id
    );

    const formatted = formatPurchaseOrderRpcError(error.message, {
      locationId: values.destination_location_id,
      locationName: locationMeta?.locationName,
      locationCode: locationMeta?.locationCode,
    });

    return {
      error: formatted.message,
      errorAction: formatted.action,
    };
  }

  revalidatePurchaseOrderPaths();
  return { success: true as const, purchaseOrderId: data as string };
}

export async function issuePurchaseOrder(raw: unknown) {
  const parsed = issuePurchaseOrderSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid purchase order." };
  }

  const { supabase } = await requireTenantId();

  const { data, error } = await supabase.rpc("issue_purchase_order", {
    p_purchase_order_id: parsed.data.purchase_order_id,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("issue_purchase_order") };
    }

    const formatted = formatPurchaseOrderRpcError(error.message);
    return {
      error: formatted.message,
      errorAction: formatted.action,
    };
  }

  revalidatePurchaseOrderPaths();
  return { success: true as const, purchaseOrderId: data as string };
}
