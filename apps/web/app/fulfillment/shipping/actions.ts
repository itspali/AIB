"use server";

import { revalidatePath } from "next/cache";
import {
  fetchSalesShipmentById,
  fetchSalesShipments,
  fetchShippableSalesOrder,
} from "@/lib/fulfillment/shipping/queries";
import type { SalesShipmentRow, ShippableSalesOrder } from "@/lib/fulfillment/shipping/types";
import { formatSalesOrderRpcError } from "@/lib/sales/orders/rpc-errors";
import { postSalesShipmentSchema } from "@/lib/sales/orders/schemas";
import { formatRpcDeployError, isMissingRpcError } from "@/lib/supabase/rpc-error";
import { requireTenantId } from "@/lib/supabase/require-tenant";

const FULFILLMENT_PATHS = [
  "/fulfillment",
  "/fulfillment/shipping",
  "/sales/orders",
  "/inventory/stock",
  "/dashboard",
] as const;

function revalidateFulfillmentPaths() {
  for (const path of FULFILLMENT_PATHS) {
    revalidatePath(path);
  }
}

export async function loadSalesShipments(): Promise<SalesShipmentRow[]> {
  const { supabase, tenantId } = await requireTenantId();
  return fetchSalesShipments(supabase, tenantId);
}

export async function loadSalesShipmentDetail(
  shipmentId: string
): Promise<{ shipment: SalesShipmentRow } | { error: string }> {
  if (!shipmentId.trim()) return { error: "Shipment id is required." };
  const { supabase, tenantId } = await requireTenantId();
  const shipment = await fetchSalesShipmentById(supabase, tenantId, shipmentId);
  if (!shipment) return { error: "Shipment not found." };
  return { shipment };
}

export async function loadShippableSalesOrder(
  salesOrderId: string
): Promise<{ order: ShippableSalesOrder } | { error: string }> {
  if (!salesOrderId.trim()) return { error: "Sales order id is required." };
  const { supabase, tenantId } = await requireTenantId();
  const order = await fetchShippableSalesOrder(supabase, tenantId, salesOrderId);
  if (!order) return { error: "Sales order not found." };
  return { order };
}

export async function postSalesShipment(raw: unknown) {
  const parsed = postSalesShipmentSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid shipment." };
  }

  const { supabase, userId } = await requireTenantId();
  const values = parsed.data;

  const { data, error } = await supabase.rpc("post_sales_shipment", {
    p_sales_order_id: values.sales_order_id,
    p_lines: values.lines.map((line) => ({
      sales_order_item_id: line.sales_order_item_id,
      quantity_shipped: Number(line.quantity_shipped),
    })),
    p_carrier_provider: values.carrier_provider,
    p_tracking_number: values.tracking_number,
    p_created_by: userId,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("post_sales_shipment") };
    }
    const formatted = formatSalesOrderRpcError(error.message);
    return {
      error: formatted.message,
      errorAction: formatted.action,
    };
  }

  revalidateFulfillmentPaths();
  return { success: true as const, shipmentId: data as string };
}
