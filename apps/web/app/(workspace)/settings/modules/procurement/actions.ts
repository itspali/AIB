"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fetchDocumentLayoutTemplate, upsertDocumentLayoutTemplate } from "@/lib/documents/document-layout-queries";
import { applyGstRegisteredDocumentLayoutOverrides } from "@/lib/documents/gst-document-layout-compliance";
import { layoutScopeKey, type DocumentLayoutScope } from "@/lib/documents/layout-scope";
import { normalizePoLayoutTemplate } from "@/lib/documents/purchase-order-layout";
import { normalizeGrnLayoutTemplate } from "@/lib/documents/goods-receipt-layout";
import { normalizeBillLayoutTemplate } from "@/lib/documents/purchase-invoice-layout";
import type { DocumentLayoutTemplate, DocumentModuleKey, DocumentViewContext } from "@/lib/documents/types";
import { resolveOrganizationSettingsAccess } from "@/lib/organization/access";
import { fetchOrganizationGstRegistered } from "@/lib/organization/gst-registration";
import type { ProcurementApprovalSettings } from "@/lib/procurement/approval-settings";
import {
  PO_AUTO_ROUND_OFF_STEP_PRESETS,
  resolvePoAutoRoundOffStep,
} from "@/lib/procurement/purchase-orders/po-auto-round-off";
import { requireTenantMutation } from "@/lib/supabase/require-tenant";
import { formatRpcDeployError, isMissingRpcError } from "@/lib/supabase/rpc-error";

const DOCUMENT_TEMPLATES_SETTINGS_PATH = "/settings/documents/templates";

export type SavePurchaseOrderDocumentLayoutInput = {
  scope: DocumentLayoutScope;
  viewContext: DocumentViewContext;
  layout: DocumentLayoutTemplate;
};

function resolveScopeLocationId(scope: DocumentLayoutScope): string | null {
  return scope.mode === "location" ? scope.locationId : null;
}

export type SaveDocumentLayoutInput = {
  scope: DocumentLayoutScope;
  viewContext: DocumentViewContext;
  layout: DocumentLayoutTemplate;
};

async function loadDocumentLayoutForModule(
  moduleKey: DocumentModuleKey,
  input: { viewContext: DocumentViewContext; scope?: DocumentLayoutScope }
): Promise<{ layout: DocumentLayoutTemplate } | { error: string }> {
  try {
    const { supabase, tenantId } = await requireTenantMutation();
    const layout = await fetchDocumentLayoutTemplate(
      supabase,
      tenantId,
      moduleKey,
      input.viewContext,
      { locationId: input.scope ? resolveScopeLocationId(input.scope) : null }
    );
    return { layout };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to load document layout.",
    };
  }
}

async function saveDocumentLayoutForModule(
  moduleKey: DocumentModuleKey,
  normalize: (layout: DocumentLayoutTemplate) => DocumentLayoutTemplate,
  revalidatePaths: string[],
  input: SaveDocumentLayoutInput
): Promise<{ success: true } | { error: string }> {
  try {
    const { supabase, tenantId, userId } = await requireTenantMutation();
    const access = await resolveOrganizationSettingsAccess(supabase, userId, tenantId);
    if (!access.granted) {
      return { error: "You do not have permission to edit document layout." };
    }

    const layout = normalize({
      ...input.layout,
      moduleKey,
      viewContext: input.viewContext,
    });

    if (layout.moduleKey !== moduleKey) {
      return { error: "Invalid module for document layout." };
    }

    const gstRegistered = await fetchOrganizationGstRegistered(supabase, tenantId);
    const persistedLayout = gstRegistered
      ? applyGstRegisteredDocumentLayoutOverrides(layout, true)
      : layout;

    void layoutScopeKey(input.scope);

    await upsertDocumentLayoutTemplate(supabase, tenantId, persistedLayout, {
      locationId: resolveScopeLocationId(input.scope),
    });

    for (const path of revalidatePaths) {
      revalidatePath(path);
    }

    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to save document layout.",
    };
  }
}

export async function loadPurchaseOrderDocumentLayout(input: {
  viewContext: DocumentViewContext;
  scope?: DocumentLayoutScope;
}): Promise<{ layout: DocumentLayoutTemplate } | { error: string }> {
  return loadDocumentLayoutForModule("PURCHASE_ORDER", input);
}

export async function loadGoodsReceiptDocumentLayout(input: {
  viewContext: DocumentViewContext;
  scope?: DocumentLayoutScope;
}): Promise<{ layout: DocumentLayoutTemplate } | { error: string }> {
  return loadDocumentLayoutForModule("GOODS_RECEIPT_NOTE", input);
}

export async function loadPurchaseInvoiceDocumentLayout(input: {
  viewContext: DocumentViewContext;
  scope?: DocumentLayoutScope;
}): Promise<{ layout: DocumentLayoutTemplate } | { error: string }> {
  return loadDocumentLayoutForModule("PURCHASE_INVOICE", input);
}

export async function savePurchaseOrderDocumentLayout(
  input: SavePurchaseOrderDocumentLayoutInput
): Promise<{ success: true } | { error: string }> {
  return saveDocumentLayoutForModule(
    "PURCHASE_ORDER",
    normalizePoLayoutTemplate,
    ["/settings/modules/procurement", DOCUMENT_TEMPLATES_SETTINGS_PATH, "/procurement/purchase-orders"],
    input
  );
}

export async function saveGoodsReceiptDocumentLayout(
  input: SaveDocumentLayoutInput
): Promise<{ success: true } | { error: string }> {
  return saveDocumentLayoutForModule(
    "GOODS_RECEIPT_NOTE",
    normalizeGrnLayoutTemplate,
    ["/settings/modules/procurement", DOCUMENT_TEMPLATES_SETTINGS_PATH, "/procurement/goods-receipts"],
    input
  );
}

export async function savePurchaseInvoiceDocumentLayout(
  input: SaveDocumentLayoutInput
): Promise<{ success: true } | { error: string }> {
  return saveDocumentLayoutForModule(
    "PURCHASE_INVOICE",
    normalizeBillLayoutTemplate,
    ["/settings/modules/procurement", DOCUMENT_TEMPLATES_SETTINGS_PATH, "/procurement/bills"],
    input
  );
}

const saveProcurementPoliciesSchema = z.object({
  po_auto_round_off_enabled: z.boolean(),
  po_auto_round_off_step: z
    .number()
    .refine((value) => PO_AUTO_ROUND_OFF_STEP_PRESETS.includes(value as (typeof PO_AUTO_ROUND_OFF_STEP_PRESETS)[number]), {
      message: "Invalid round-off step.",
    }),
  is_po_mandatory_for_grn: z.boolean(),
  is_qc_required_before_stocking: z.boolean(),
  allow_qc_line_override: z.boolean(),
  allow_zero_cost_receipts: z.boolean(),
  promo_default_category: z.string().trim().min(1).max(64),
  landed_cost_allocation_method: z.enum(["BY_QUANTITY", "BY_VALUE", "BY_WEIGHT"]),
  absorb_sunk_logistics_overhead: z.boolean(),
  matching_tolerance_percentage: z.number().min(0).max(100),
  po_mrp_trade_terms_enabled: z.boolean(),
  allow_edit_issued_purchase_orders: z.boolean(),
  allow_line_item_discounts: z.boolean(),
  allow_transaction_discounts: z.boolean(),
  purchase_prices_tax_inclusive: z.boolean(),
});

export async function saveProcurementPolicies(raw: unknown) {
  try {
    const parsed = saveProcurementPoliciesSchema.safeParse(raw);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid procurement policies." };
    }

    const { supabase, tenantId, userId } = await requireTenantMutation();
    const access = await resolveOrganizationSettingsAccess(supabase, userId, tenantId);
    if (!access.granted) {
      return { error: "You do not have permission to edit procurement policies." };
    }

    const { error } = await supabase.rpc("upsert_tenant_workspace_control", {
      p_registry_key: "PROCUREMENT_SETTINGS",
      p_metadata_patch: {
        po_auto_round_off_enabled: parsed.data.po_auto_round_off_enabled,
        po_auto_round_off_step: resolvePoAutoRoundOffStep(parsed.data.po_auto_round_off_step),
        is_po_mandatory_for_grn: parsed.data.is_po_mandatory_for_grn,
        is_qc_required_before_stocking: parsed.data.is_qc_required_before_stocking,
        allow_qc_line_override: parsed.data.allow_qc_line_override,
        allow_zero_cost_receipts: parsed.data.allow_zero_cost_receipts,
        promo_default_category: parsed.data.promo_default_category,
        landed_cost_allocation_method: parsed.data.landed_cost_allocation_method,
        absorb_sunk_logistics_overhead: parsed.data.absorb_sunk_logistics_overhead,
        matching_tolerance_percentage: parsed.data.matching_tolerance_percentage,
        po_mrp_trade_terms_enabled: parsed.data.po_mrp_trade_terms_enabled,
        allow_edit_issued_purchase_orders: parsed.data.allow_edit_issued_purchase_orders,
        allow_line_item_discounts: parsed.data.allow_line_item_discounts,
        allow_transaction_discounts: parsed.data.allow_transaction_discounts,
        purchase_prices_tax_inclusive: parsed.data.purchase_prices_tax_inclusive,
      },
    });

    if (error) {
      if (isMissingRpcError(error)) {
        return { error: formatRpcDeployError("upsert_tenant_workspace_control") };
      }
      return { error: error.message };
    }

    revalidatePath("/settings/modules/procurement");
    revalidatePath("/procurement/purchase-orders");
    revalidatePath("/procurement");

    return { success: true as const };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to save procurement policies.",
    };
  }
}

const saveImportLogisticsSettingsSchema = z.object({
  import_receipt_document_strategy: z.enum([
    "SINGLE_GRN_WITH_STAGES",
    "SEPARATE_GRNS_PER_STAGE",
    "SINGLE_FINAL_ONLY",
  ]),
  import_receipt_mode: z.enum([
    "DIRECT_TO_WAREHOUSE",
    "STAGING_THEN_GIT",
    "STAGING_THEN_TRANSFER",
  ]),
  po_fulfillment_stage: z.enum(["COMMERCIAL", "FINAL"]),
  require_boe_on_first_receipt: z.enum(["ALWAYS", "NEVER", "ON_FINAL_RECEIPT_ONLY"]),
  allow_staging_receipt_location_mismatch: z.boolean(),
  allow_commercial_receipt_before_customs: z.boolean(),
  git_enabled: z.boolean(),
});

export async function saveImportLogisticsSettings(raw: unknown) {
  try {
    const parsed = saveImportLogisticsSettingsSchema.safeParse(raw);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid import logistics settings." };
    }

    const { supabase, tenantId, userId } = await requireTenantMutation();
    const access = await resolveOrganizationSettingsAccess(supabase, userId, tenantId);
    if (!access.granted) {
      return { error: "You do not have permission to edit import logistics settings." };
    }

    const { error } = await supabase.rpc("upsert_tenant_workspace_control", {
      p_registry_key: "IMPORT_LOGISTICS_SETTINGS",
      p_metadata_patch: parsed.data,
    });

    if (error) {
      if (isMissingRpcError(error)) {
        return { error: formatRpcDeployError("upsert_tenant_workspace_control") };
      }
      return { error: error.message };
    }

    revalidatePath("/settings/modules/procurement");
    revalidatePath("/procurement/purchase-orders");
    revalidatePath("/procurement/goods-receipts");
    revalidatePath("/procurement/goods-in-transit");
    revalidatePath("/procurement/shipments");

    return { success: true as const };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to save import logistics settings.",
    };
  }
}

const approvalPolicyBandSchema = z.object({
  min_amount: z.number().nonnegative(),
  max_amount: z.number().nonnegative().nullable(),
  skip: z.boolean().optional(),
  self_approve: z.boolean().optional(),
  levels: z
    .array(
      z.object({
        steps: z.array(
          z.object({
            label: z.string().min(1),
            quorum: z.enum(["ANY", "ALL"]),
            pool: z.string().min(1),
            assignee: z
              .enum(["POOL", "SUBMITTER_MANAGER", "SUBMITTER_SKIP_MANAGER"])
              .optional(),
          })
        ),
      })
    )
    .optional(),
});

const poApprovalRuleSchema = z.object({
  type: z.enum(["LINE_QTY_ABOVE", "LINE_PRICE_ABOVE_SUPPLIER", "LINE_PRICE_ABOVE_CATALOG"]),
  enabled: z.boolean(),
  threshold: z.number().nonnegative().nullable().optional(),
  tolerance_percent: z.number().nonnegative().nullable().optional(),
});

const saveProcurementApprovalSettingsSchema = z.object({
  require_po_approval_before_issue: z.boolean(),
  po_approval_threshold_amount: z
    .number()
    .nonnegative("Threshold must be zero or greater.")
    .nullable(),
  allow_submitter_self_approve_below_threshold: z.boolean(),
  po_approver_user_ids: z.array(z.string().uuid()),
  po_approver_roles: z.array(z.enum(["ADMIN", "MANAGER"])).optional(),
  po_approval_rules: z.array(poApprovalRuleSchema).optional(),
  po_workflow_template: z.enum(["standard", "manager_chain_finance", "custom"]).optional(),
  po_finance_approver_user_ids: z.array(z.string().uuid()).optional(),
  po_approval_bands: z.array(approvalPolicyBandSchema).optional(),
  po_approver_pools: z
    .record(
      z.string(),
      z.object({
        user_ids: z.array(z.string().uuid()),
        roles: z.array(z.enum(["ADMIN", "MANAGER"])).optional(),
      })
    )
    .optional(),
  po_approval_respect_destination_location: z.boolean().optional(),
  po_approval_reminder_hours: z.number().int().min(0).nullable().optional(),
  po_approval_escalation_hours: z.number().int().min(0).nullable().optional(),
  po_auto_issue_after_approval: z.boolean().optional(),
  po_manual_issue_actor: z.enum(["submitter", "editors", "submitter_or_owner"]).optional(),
});

export async function fetchPendingPoApprovalRunCount(): Promise<number> {
  try {
    const { supabase } = await requireTenantMutation();
    const { data, error } = await supabase.rpc("count_pending_po_approval_runs");
    if (error) return 0;
    return typeof data === "number" ? data : Number(data ?? 0);
  } catch {
    return 0;
  }
}

export async function saveProcurementApprovalSettings(
  raw: ProcurementApprovalSettings,
  options?: { reroutePending?: boolean }
): Promise<{ success: true; rerouted?: number; releasedToDraft?: number } | { error: string }> {
  try {
    const parsed = saveProcurementApprovalSettingsSchema.safeParse(raw);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid approval settings." };
    }

    const { supabase, tenantId, userId } = await requireTenantMutation();
    const access = await resolveOrganizationSettingsAccess(supabase, userId, tenantId);
    if (!access.granted) {
      return { error: "You do not have permission to edit approval settings." };
    }

    const approverRoles = parsed.data.po_approver_roles ?? [];
    const defaultPool = {
      user_ids: parsed.data.po_approver_user_ids,
      roles: approverRoles,
    };

    const { error } = await supabase.rpc("upsert_tenant_workspace_control", {
      p_registry_key: "APPROVAL_SETTINGS",
      p_metadata_patch: {
        require_po_approval_before_issue: parsed.data.require_po_approval_before_issue,
        po_approval_threshold_amount: parsed.data.po_approval_threshold_amount,
        allow_submitter_self_approve_below_threshold:
          parsed.data.allow_submitter_self_approve_below_threshold,
        po_approver_user_ids: parsed.data.po_approver_user_ids,
        po_approver_roles: approverRoles,
        po_approval_rules: parsed.data.po_approval_rules ?? [],
        po_workflow_template: parsed.data.po_workflow_template ?? "standard",
        po_finance_approver_user_ids: parsed.data.po_finance_approver_user_ids ?? [],
        po_approval_bands: parsed.data.po_approval_bands ?? [],
        po_approver_pools: parsed.data.po_approver_pools ?? {
          default: defaultPool,
        },
        po_approval_respect_destination_location:
          parsed.data.po_approval_respect_destination_location ?? true,
        po_approval_reminder_hours: parsed.data.po_approval_reminder_hours ?? 24,
        po_approval_escalation_hours: parsed.data.po_approval_escalation_hours ?? 72,
        po_auto_issue_after_approval: parsed.data.po_auto_issue_after_approval ?? true,
        po_manual_issue_actor: parsed.data.po_manual_issue_actor ?? "submitter",
      },
    });

    if (error) {
      if (isMissingRpcError(error)) {
        return { error: formatRpcDeployError("upsert_tenant_workspace_control") };
      }
      return { error: error.message };
    }

    let rerouted = 0;
    let releasedToDraft = 0;

    if (options?.reroutePending) {
      const { data: rerouteResult, error: rerouteError } = await supabase.rpc(
        "reroute_pending_po_approval_runs"
      );
      if (rerouteError) {
        if (isMissingRpcError(rerouteError)) {
          return { error: formatRpcDeployError("reroute_pending_po_approval_runs") };
        }
        return { error: rerouteError.message };
      }
      if (rerouteResult && typeof rerouteResult === "object") {
        const payload = rerouteResult as { rerouted?: number; released_to_draft?: number };
        rerouted = Number(payload.rerouted ?? 0);
        releasedToDraft = Number(payload.released_to_draft ?? 0);
      }
    }

    revalidatePath("/settings/modules/procurement");
    revalidatePath("/procurement/purchase-orders");
    revalidatePath("/procurement");
    revalidatePath("/dashboard");
    revalidatePath("/approvals");

    return { success: true as const, rerouted, releasedToDraft };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to save approval settings.",
    };
  }
}

export async function runPoApprovalSlaReminders(): Promise<
  | { reminders_sent: number; escalations_sent: number }
  | { error: string }
> {
  try {
    const { supabase, tenantId, userId } = await requireTenantMutation();
    const access = await resolveOrganizationSettingsAccess(supabase, userId, tenantId);
    if (!access.isOwner) {
      return { error: "Only workspace owners can run approval SLA reminders." };
    }

    const { data, error } = await supabase.rpc("run_po_approval_sla_reminders");
    if (error) {
      if (isMissingRpcError(error)) {
        return { error: formatRpcDeployError("run_po_approval_sla_reminders") };
      }
      return { error: error.message };
    }

    const payload =
      data && typeof data === "object"
        ? (data as { reminders_sent?: number; escalations_sent?: number })
        : {};

    return {
      reminders_sent: Number(payload.reminders_sent ?? 0),
      escalations_sent: Number(payload.escalations_sent ?? 0),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to run approval SLA reminders.",
    };
  }
}

const saveFinancialProcurementSettingsSchema = z.object({
  ppv_expense_account_id: z.string().uuid().nullable(),
  promo_contra_expense_account_id: z.string().uuid().nullable(),
  git_holding_account_id: z.string().uuid().nullable(),
  vendor_prepayment_account_id: z.string().uuid().nullable(),
});

export async function saveFinancialProcurementSettings(
  raw: unknown
): Promise<{ success: true } | { error: string }> {
  try {
    const parsed = saveFinancialProcurementSettingsSchema.safeParse(raw);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid financial settings." };
    }

    const { supabase, tenantId, userId } = await requireTenantMutation();
    const access = await resolveOrganizationSettingsAccess(supabase, userId, tenantId);
    if (!access.granted) {
      return { error: "You do not have permission to edit financial settings." };
    }

    const { error } = await supabase.rpc("upsert_tenant_workspace_control", {
      p_registry_key: "FINANCIAL_SETTINGS",
      p_metadata_patch: {
        ppv_expense_account_id: parsed.data.ppv_expense_account_id,
        promo_contra_expense_account_id: parsed.data.promo_contra_expense_account_id,
        git_holding_account_id: parsed.data.git_holding_account_id,
        vendor_prepayment_account_id: parsed.data.vendor_prepayment_account_id,
      },
    });

    if (error) {
      if (isMissingRpcError(error)) {
        return { error: formatRpcDeployError("upsert_tenant_workspace_control") };
      }
      return { error: error.message };
    }

    revalidatePath("/settings/modules/procurement");
    revalidatePath("/procurement/bills");
    revalidatePath("/procurement");

    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to save financial settings.",
    };
  }
}
