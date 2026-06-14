"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fetchSubcontractWipLocations } from "@/lib/procurement/git/queries";
import { fetchProcurementSuppliers } from "@/lib/procurement/shared/queries";
import { formatRpcDeployError, isMissingRpcError } from "@/lib/supabase/rpc-error";
import { requireTenantId } from "@/lib/supabase/require-tenant";

const SUBCONTRACT_PATHS = ["/procurement", "/procurement/goods-receipts", "/inventory/stock"] as const;

const bomLineSchema = z.object({
  component_item_id: z.string().uuid(),
  quantity_per: z.string().trim().min(1),
});

const saveBomSchema = z.object({
  parent_item_id: z.string().uuid(),
  lines: z.array(bomLineSchema),
});

const linkSchema = z.object({
  supplier_id: z.string().uuid(),
  location_id: z.string().uuid(),
});

function revalidateSubcontractPaths() {
  for (const path of SUBCONTRACT_PATHS) revalidatePath(path);
}

export async function loadSubcontractAdminContext() {
  const { supabase, tenantId } = await requireTenantId();

  const [suppliers, wipLocations, jobLinks, bomLines] = await Promise.all([
    fetchProcurementSuppliers(supabase, tenantId),
    fetchSubcontractWipLocations(supabase, tenantId),
    supabase
      .from("vendor_job_work_locations")
      .select("id, supplier_id, location_id, is_active")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    supabase
      .from("subcontract_bom_lines")
      .select("id, parent_item_id, component_item_id, quantity_per")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
  ]);

  if (jobLinks.error) throw new Error(jobLinks.error.message);
  if (bomLines.error) throw new Error(bomLines.error.message);

  const supplierNameById = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));
  const itemIds = [
    ...new Set(
      (bomLines.data ?? []).flatMap((row) => [
        row.parent_item_id as string,
        row.component_item_id as string,
      ])
    ),
  ].filter(Boolean);
  const { data: itemRows } = itemIds.length
    ? await supabase.from("items").select("id, name").eq("tenant_id", tenantId).in("id", itemIds)
    : { data: [] };
  const itemNameById = new Map((itemRows ?? []).map((row) => [String(row.id), String(row.name)]));

  return {
    suppliers,
    wipLocations,
    jobLinks: (jobLinks.data ?? []).map((row) => ({
      id: row.id as string,
      supplier_id: row.supplier_id as string,
      supplier_name: supplierNameById.get(row.supplier_id as string) ?? "",
      location_id: row.location_id as string,
      is_active: Boolean(row.is_active),
    })),
    bomLines: (bomLines.data ?? []).map((row) => ({
      id: row.id as string,
      parent_item_id: row.parent_item_id as string,
      parent_item_name: itemNameById.get(row.parent_item_id as string) ?? "",
      component_item_id: row.component_item_id as string,
      component_name: itemNameById.get(row.component_item_id as string) ?? "",
      quantity_per: String(row.quantity_per ?? "0"),
    })),
  };
}

export async function saveVendorJobWorkLocation(raw: unknown) {
  const parsed = linkSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid subcontract link." };
  }

  const { supabase } = await requireTenantId();
  const { data, error } = await supabase.rpc("save_vendor_job_work_location", {
    p_supplier_id: parsed.data.supplier_id,
    p_location_id: parsed.data.location_id,
    p_is_active: true,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("save_vendor_job_work_location") };
    }
    return { error: error.message };
  }

  revalidateSubcontractPaths();
  return { success: true as const, linkId: data as string };
}

export async function saveSubcontractBomLines(raw: unknown) {
  const parsed = saveBomSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid subcontract BOM." };
  }

  const { supabase } = await requireTenantId();
  const { data, error } = await supabase.rpc("save_subcontract_bom_lines", {
    p_parent_item_id: parsed.data.parent_item_id,
    p_lines: parsed.data.lines.map((line) => ({
      component_item_id: line.component_item_id,
      quantity_per: Number(line.quantity_per),
    })),
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("save_subcontract_bom_lines") };
    }
    return { error: error.message };
  }

  revalidateSubcontractPaths();
  return { success: true as const, lineCount: (data as { line_count?: number })?.line_count ?? 0 };
}
