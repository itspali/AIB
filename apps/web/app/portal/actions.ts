"use server";

import { revalidatePath } from "next/cache";
import { fetchSupplierPortalContext } from "@/lib/supplier-portal/queries";
import { formatRpcDeployError, isMissingRpcError } from "@/lib/supabase/rpc-error";
import { requireTenantId } from "@/lib/supabase/require-tenant";
import { z } from "zod";

const PORTAL_PATHS = ["/portal", "/portal/purchase-orders"] as const;

function revalidatePortalPaths() {
  for (const path of PORTAL_PATHS) {
    revalidatePath(path);
  }
}

export async function acknowledgePortalPurchaseOrder(
  purchaseOrderId: string
): Promise<{ success: true } | { error: string }> {
  const parsed = z.string().uuid().safeParse(purchaseOrderId);
  if (!parsed.success) return { error: "Invalid purchase order." };

  try {
    const { supabase, tenantId, userId } = await requireTenantId();
    const portal = await fetchSupplierPortalContext(supabase, tenantId, userId);
    if (!portal) return { error: "Supplier portal access is not configured for your account." };

    const { error } = await supabase.rpc("acknowledge_purchase_order", {
      p_purchase_order_id: parsed.data,
    });

    if (error) {
      if (isMissingRpcError(error)) {
        return { error: formatRpcDeployError("acknowledge_purchase_order") };
      }
      return { error: error.message };
    }

    revalidatePortalPaths();
    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to acknowledge purchase order.",
    };
  }
}

export async function registerSupplierInvoiceUpload(input: {
  purchaseOrderId?: string | null;
  storagePath: string;
  fileName: string;
  fileSizeBytes?: number | null;
  mimeType?: string | null;
  vendorInvoiceNumber?: string | null;
}): Promise<{ success: true; uploadId: string } | { error: string }> {
  try {
    const { supabase, tenantId, userId } = await requireTenantId();
    const portal = await fetchSupplierPortalContext(supabase, tenantId, userId);
    if (!portal) return { error: "Supplier portal access is not configured for your account." };

    const purchaseOrderId = input.purchaseOrderId?.trim() || null;

    const { data, error } = await supabase
      .from("supplier_invoice_uploads")
      .insert({
        tenant_id: tenantId,
        supplier_entity_id: portal.supplierEntityId,
        purchase_order_id: purchaseOrderId,
        storage_path: input.storagePath,
        file_name: input.fileName,
        file_size_bytes: input.fileSizeBytes ?? null,
        mime_type: input.mimeType ?? null,
        vendor_invoice_number: input.vendorInvoiceNumber?.trim() || null,
        uploaded_by: userId,
        status: "PENDING_REVIEW",
      })
      .select("id")
      .single();

    if (error) return { error: error.message };

    revalidatePortalPaths();
    return { success: true, uploadId: data.id as string };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to register invoice upload.",
    };
  }
}
