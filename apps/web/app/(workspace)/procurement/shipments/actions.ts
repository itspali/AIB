"use server";

import { revalidatePath } from "next/cache";
import {
  fetchAllocatableImportPurchaseOrders,
  fetchImportShipmentById,
  fetchImportShipmentLines,
  fetchImportShipments,
} from "@/lib/procurement/shipments/queries";
import {
  allocateShipmentLinesSchema,
  saveImportShipmentSchema,
  updateImportShipmentStatusSchema,
} from "@/lib/procurement/shipments/schemas";
import type {
  AllocatableImportPurchaseOrderOption,
  ImportShipmentLineRow,
  ImportShipmentRow,
} from "@/lib/procurement/shipments/types";
import { fetchProcurementLocations, fetchProcurementSuppliers } from "@/lib/procurement/shared/queries";
import { formatRpcDeployError, isMissingRpcError } from "@/lib/supabase/rpc-error";
import { requireTenantMutation } from "@/lib/supabase/require-tenant";

const SHIPMENT_PATHS = [
  "/procurement/shipments",
  "/procurement/goods-receipts",
  "/procurement/goods-in-transit",
  "/procurement/purchase-orders",
  "/procurement",
] as const;

function revalidateShipmentPaths() {
  for (const path of SHIPMENT_PATHS) revalidatePath(path);
}

export async function loadImportShipments(): Promise<ImportShipmentRow[]> {
  const { supabase, tenantId } = await requireTenantMutation();
  return fetchImportShipments(supabase, tenantId);
}

export async function loadImportShipmentDetail(shipmentId: string): Promise<
  | {
      shipment: ImportShipmentRow;
      lines: ImportShipmentLineRow[];
    }
  | { error: string }
> {
  if (!shipmentId.trim()) return { error: "Shipment id is required." };
  const { supabase, tenantId } = await requireTenantMutation();
  const [shipment, lines] = await Promise.all([
    fetchImportShipmentById(supabase, tenantId, shipmentId),
    fetchImportShipmentLines(supabase, tenantId, shipmentId),
  ]);
  if (!shipment) return { error: "Import shipment not found." };
  return { shipment, lines };
}

export async function loadShipmentCatalogContext(): Promise<{
  shipments: ImportShipmentRow[];
  suppliers: Awaited<ReturnType<typeof fetchProcurementSuppliers>>;
  locations: Awaited<ReturnType<typeof fetchProcurementLocations>>;
  allocatableOrders: AllocatableImportPurchaseOrderOption[];
}> {
  const { supabase, tenantId } = await requireTenantMutation();
  const [shipments, suppliers, locations, allocatableOrders] = await Promise.all([
    fetchImportShipments(supabase, tenantId),
    fetchProcurementSuppliers(supabase, tenantId),
    fetchProcurementLocations(supabase, tenantId),
    fetchAllocatableImportPurchaseOrders(supabase, tenantId),
  ]);
  return { shipments, suppliers, locations, allocatableOrders };
}

export async function saveImportShipment(raw: unknown) {
  const parsed = saveImportShipmentSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid import shipment." };
  }

  const values = parsed.data;
  const { supabase, userId } = await requireTenantMutation();

  const { data, error } = await supabase.rpc("save_import_shipment", {
    p_shipment_id: values.shipment_id ?? null,
    p_supplier_id: values.supplier_id,
    p_forwarder_entity_id: values.forwarder_entity_id ?? null,
    p_staging_location_id: values.staging_location_id ?? null,
    p_ultimate_destination_location_id: values.ultimate_destination_location_id ?? null,
    p_incoterms_code: values.incoterms_code?.trim() || null,
    p_bill_of_lading: values.bill_of_lading?.trim() || null,
    p_container_numbers: values.container_numbers,
    p_awb: values.awb?.trim() || null,
    p_vessel_name: values.vessel_name?.trim() || null,
    p_port_of_loading: values.port_of_loading?.trim() || null,
    p_port_of_discharge: values.port_of_discharge?.trim() || null,
    p_etd: values.etd || null,
    p_eta: values.eta || null,
    p_bill_of_entry_number: values.bill_of_entry_number?.trim() || null,
    p_bill_of_entry_date: values.bill_of_entry_date || null,
    p_port_code: values.port_code?.trim() || null,
    p_exchange_rate: Number(values.exchange_rate || 1),
    p_assessable_value: Number(values.assessable_value || 0),
    p_customs_duty_amount: Number(values.customs_duty_amount || 0),
    p_import_igst_amount: Number(values.import_igst_amount || 0),
    p_notes: values.notes?.trim() || null,
    p_custom_fields: {},
    p_created_by: userId,
    p_purchase_order_ids: values.purchase_order_ids,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("save_import_shipment") };
    }
    return { error: error.message };
  }

  revalidateShipmentPaths();
  return { success: true as const, shipmentId: String(data) };
}

export async function allocatePoLinesToShipment(raw: unknown) {
  const parsed = allocateShipmentLinesSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid shipment line allocation." };
  }

  const values = parsed.data;
  const { supabase, userId } = await requireTenantMutation();

  const { data, error } = await supabase.rpc("allocate_po_lines_to_shipment", {
    p_shipment_id: values.shipment_id,
    p_lines: values.lines.map((line) => ({
      purchase_order_id: line.purchase_order_id,
      po_item_id: line.po_item_id,
      variant_id: line.variant_id,
      quantity_shipped: Number(line.quantity_shipped),
    })),
    p_updated_by: userId,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("allocate_po_lines_to_shipment") };
    }
    return { error: error.message };
  }

  revalidateShipmentPaths();
  const payload = data as { line_count?: number };
  return { success: true as const, lineCount: payload.line_count ?? values.lines.length };
}

export async function issueImportShipment(shipmentId: string) {
  if (!shipmentId.trim()) return { error: "Shipment id is required." };
  const { supabase } = await requireTenantMutation();

  const { data, error } = await supabase.rpc("issue_import_shipment", {
    p_shipment_id: shipmentId,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("issue_import_shipment") };
    }
    return { error: error.message };
  }

  revalidateShipmentPaths();
  const payload = data as { shipment_number?: string; status?: string };
  return {
    success: true as const,
    shipmentNumber: payload.shipment_number ?? "",
    status: payload.status ?? "BOOKED",
  };
}

export async function updateImportShipmentStatus(raw: unknown) {
  const parsed = updateImportShipmentStatusSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid status update." };
  }

  const values = parsed.data;
  const { supabase, userId } = await requireTenantMutation();

  const { data, error } = await supabase.rpc("update_import_shipment_status", {
    p_shipment_id: values.shipment_id,
    p_status: values.status,
    p_updated_by: userId,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("update_import_shipment_status") };
    }
    return { error: error.message };
  }

  revalidateShipmentPaths();
  const payload = data as { status?: string };
  return { success: true as const, status: payload.status ?? values.status };
}
