"use server";

import { revalidatePath } from "next/cache";
import {
  fetchQcInspectionQueuePage,
  fetchQcInspectionQueueRowByLineId,
  fetchQcTestTemplateForItem,
} from "@/lib/procurement/quality-inspection/queries";
import type { CompleteQcLineInspectionInput } from "@/lib/procurement/quality-inspection/types";
import {
  buildQcTestTemplateSavePayload,
  validateQcTestTemplateForm,
  type QcTestTemplateFormState,
} from "@/lib/procurement/quality-inspection/template-form";
import {
  deleteQcTestTemplateByScope,
  fetchQcTestTemplateByScope,
  saveQcTestTemplateByScope,
  type QcTestTemplateScope,
} from "@/lib/procurement/quality-inspection/template-queries";
import { formatRpcDeployError, isMissingRpcError } from "@/lib/supabase/rpc-error";
import { requireTenantId, requireTenantMutation } from "@/lib/supabase/require-tenant";

const QC_PATHS = [
  "/procurement/quality-inspection",
  "/procurement/goods-receipts",
  "/procurement",
  "/inventory/stock",
  "/inventory",
  "/items",
  "/items/categories",
] as const;

function revalidateQcPaths() {
  for (const path of QC_PATHS) {
    revalidatePath(path);
  }
}

export async function fetchMoreQcInspectionQueueRows(
  offset: number,
  locationId?: string | null
) {
  const { supabase, tenantId } = await requireTenantMutation();
  return fetchQcInspectionQueuePage(supabase, tenantId, { offset, locationId });
}

export async function loadQcInspectionQueueRows(locationId?: string | null) {
  const { supabase, tenantId } = await requireTenantMutation();
  const page = await fetchQcInspectionQueuePage(supabase, tenantId, { locationId });
  return page.rows;
}

export async function loadQcInspectionQueueRow(goodsReceiptItemId: string) {
  if (!goodsReceiptItemId.trim()) return { error: "Line id is required." as const };
  const { supabase, tenantId } = await requireTenantMutation();
  const row = await fetchQcInspectionQueueRowByLineId(supabase, tenantId, goodsReceiptItemId);
  if (!row) return { error: "QC queue line not found or already released." as const };
  return { row };
}

export async function loadQcTestTemplateForItem(itemId: string) {
  if (!itemId.trim()) return { template: null };
  const { supabase, tenantId } = await requireTenantId();
  const template = await fetchQcTestTemplateForItem(supabase, tenantId, itemId);
  return { template };
}

export async function completeQcLineInspection(input: CompleteQcLineInspectionInput) {
  const itemId = input.goods_receipt_item_id?.trim();
  if (!itemId) return { error: "Goods receipt line id is required." };

  const released = Number(input.quantity_released);
  if (!Number.isFinite(released) || released < 0) {
    return { error: "Pass quantity is invalid." };
  }

  const failed = input.quantity_failed?.trim() ? Number(input.quantity_failed) : 0;
  if (!Number.isFinite(failed) || failed < 0) {
    return { error: "Reject quantity is invalid." };
  }

  if (released <= 0 && failed <= 0) {
    return { error: "Enter a pass or reject quantity." };
  }

  const { supabase, userId } = await requireTenantMutation();

  const resultLines = (input.result_lines ?? []).map((line) => ({
    parameter_id: line.parameter_id ?? null,
    parameter_name: line.parameter_name,
    parameter_type: line.parameter_type,
    min_value: line.min_value ?? null,
    max_value: line.max_value ?? null,
    expected_text: line.expected_text ?? null,
    choice_options: line.choice_options ?? [],
    measured_value: line.measured_value,
    result: line.result,
    is_mandatory: line.is_mandatory,
    sort_order: line.sort_order,
  }));

  const { data, error } = await supabase.rpc("complete_qc_line_inspection", {
    p_goods_receipt_item_id: itemId,
    p_quantity_released: released,
    p_quantity_failed: failed,
    p_failed_disposition: input.failed_disposition ?? "SCRAP",
    p_notes: input.notes ?? null,
    p_result_lines: resultLines,
    p_inspected_by: userId,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("complete_qc_line_inspection") };
    }
    return { error: error.message };
  }

  revalidateQcPaths();
  return { success: true as const, detail: data };
}

export async function bulkPassQcInspectionLines(goodsReceiptItemIds: string[]) {
  const uniqueIds = [...new Set(goodsReceiptItemIds.filter(Boolean))];
  if (!uniqueIds.length) return { error: "Select at least one line." };

  const { supabase, tenantId, userId } = await requireTenantMutation();
  const failures: string[] = [];

  for (const lineId of uniqueIds) {
    const row = await fetchQcInspectionQueueRowByLineId(supabase, tenantId, lineId);
    if (!row) {
      failures.push(`${lineId}: not on QC hold`);
      continue;
    }

    const onHold = Number(row.quantity_on_hold);
    if (!Number.isFinite(onHold) || onHold <= 0) {
      failures.push(`${row.variant_sku}: nothing on hold`);
      continue;
    }

    const template = await fetchQcTestTemplateForItem(supabase, tenantId, row.item_id);
    if (template && template.parameters.some((parameter) => parameter.is_mandatory)) {
      failures.push(`${row.variant_sku}: mandatory QC tests — open and inspect individually`);
      continue;
    }

    const { error } = await supabase.rpc("complete_qc_line_inspection", {
      p_goods_receipt_item_id: lineId,
      p_quantity_released: onHold,
      p_quantity_failed: 0,
      p_failed_disposition: "SCRAP",
      p_notes: null,
      p_result_lines: [],
      p_inspected_by: userId,
    });

    if (error) {
      failures.push(`${row.variant_sku}: ${error.message}`);
    }
  }

  revalidateQcPaths();

  if (failures.length === uniqueIds.length) {
    return { error: failures[0] ?? "Bulk pass failed." };
  }

  return {
    success: true as const,
    passedCount: uniqueIds.length - failures.length,
    failures,
  };
}

export async function bulkFailQcInspectionLines(
  goodsReceiptItemIds: string[],
  disposition: "RTV" | "SCRAP" | "DAMAGE" | "SHRINK" = "SCRAP"
) {
  const uniqueIds = [...new Set(goodsReceiptItemIds.filter(Boolean))];
  if (!uniqueIds.length) return { error: "Select at least one line." };

  const { supabase, tenantId, userId } = await requireTenantMutation();
  const failures: string[] = [];

  for (const lineId of uniqueIds) {
    const row = await fetchQcInspectionQueueRowByLineId(supabase, tenantId, lineId);
    if (!row) {
      failures.push(`${lineId}: not on QC hold`);
      continue;
    }

    const onHold = Number(row.quantity_on_hold);
    if (!Number.isFinite(onHold) || onHold <= 0) {
      failures.push(`${row.variant_sku}: nothing on hold`);
      continue;
    }

    const template = await fetchQcTestTemplateForItem(supabase, tenantId, row.item_id);
    if (template && template.parameters.some((parameter) => parameter.is_mandatory)) {
      failures.push(`${row.variant_sku}: mandatory QC tests — open and inspect individually`);
      continue;
    }

    const { error } = await supabase.rpc("complete_qc_line_inspection", {
      p_goods_receipt_item_id: lineId,
      p_quantity_released: 0,
      p_quantity_failed: onHold,
      p_failed_disposition: disposition,
      p_notes: null,
      p_result_lines: [],
      p_inspected_by: userId,
    });

    if (error) {
      failures.push(`${row.variant_sku}: ${error.message}`);
    }
  }

  revalidateQcPaths();

  if (failures.length === uniqueIds.length) {
    return { error: failures[0] ?? "Bulk fail failed." };
  }

  return {
    success: true as const,
    failedCount: uniqueIds.length - failures.length,
    failures,
  };
}

export async function loadQcTestTemplateForScope(
  scopeType: QcTestTemplateScope,
  scopeReferenceId: string
) {
  if (!scopeReferenceId.trim()) return { template: null };
  const { supabase, tenantId } = await requireTenantId();
  const template = await fetchQcTestTemplateByScope(
    supabase,
    tenantId,
    scopeType,
    scopeReferenceId
  );
  return { template };
}

export async function saveQcTestTemplateForScope(
  scopeType: QcTestTemplateScope,
  scopeReferenceId: string,
  form: QcTestTemplateFormState
) {
  if (!scopeReferenceId.trim()) return { error: "Save the record before defining QC tests." };

  const validationError = validateQcTestTemplateForm(form);
  if (validationError) return { error: validationError };

  const payload = buildQcTestTemplateSavePayload(form);
  const { supabase, tenantId } = await requireTenantMutation();

  try {
    if (payload.clear) {
      await deleteQcTestTemplateByScope(supabase, tenantId, scopeType, scopeReferenceId);
      revalidateQcPaths();
      return { success: true as const, template: null };
    }

    const template = await saveQcTestTemplateByScope(
      supabase,
      tenantId,
      scopeType,
      scopeReferenceId,
      payload
    );
    revalidateQcPaths();
    return { success: true as const, template };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save QC test template." };
  }
}
