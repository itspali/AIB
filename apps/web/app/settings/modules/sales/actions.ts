"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fetchDocumentLayoutTemplate, upsertDocumentLayoutTemplate } from "@/lib/documents/document-layout-queries";
import { applyGstRegisteredDocumentLayoutOverrides } from "@/lib/documents/gst-document-layout-compliance";
import { layoutScopeKey, type DocumentLayoutScope } from "@/lib/documents/layout-scope";
import type { DocumentLayoutTemplate, DocumentModuleKey, DocumentViewContext } from "@/lib/documents/types";
import { resolveOrganizationSettingsAccess } from "@/lib/organization/access";
import { fetchOrganizationGstRegistered } from "@/lib/organization/gst-registration";
import type { SalesApprovalSettings } from "@/lib/sales/approval-settings";
import { SALES_DOCUMENT_CONVERSION_MODES } from "@/lib/sales/document-conversion-settings";
import {
  normalizeSalesInvoiceLayoutTemplate,
  normalizeSalesOrderLayoutTemplate,
  normalizeSalesQuotationLayoutTemplate,
} from "@/lib/sales/shared/sales-commerce-layout";
import { requireTenantId } from "@/lib/supabase/require-tenant";
import { formatRpcDeployError, isMissingRpcError } from "@/lib/supabase/rpc-error";

export type SaveDocumentLayoutInput = {
  scope: DocumentLayoutScope;
  viewContext: DocumentViewContext;
  layout: DocumentLayoutTemplate;
};

function resolveScopeLocationId(scope: DocumentLayoutScope): string | null {
  return scope.mode === "location" ? scope.locationId : null;
}

async function loadDocumentLayoutForModule(
  moduleKey: DocumentModuleKey,
  input: { viewContext: DocumentViewContext; scope?: DocumentLayoutScope }
): Promise<{ layout: DocumentLayoutTemplate } | { error: string }> {
  try {
    const { supabase, tenantId } = await requireTenantId();
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
    const { supabase, tenantId, userId } = await requireTenantId();
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

export async function loadSalesQuotationDocumentLayout(input: {
  viewContext: DocumentViewContext;
  scope?: DocumentLayoutScope;
}): Promise<{ layout: DocumentLayoutTemplate } | { error: string }> {
  return loadDocumentLayoutForModule("SALES_QUOTATION", input);
}

export async function loadSalesOrderDocumentLayout(input: {
  viewContext: DocumentViewContext;
  scope?: DocumentLayoutScope;
}): Promise<{ layout: DocumentLayoutTemplate } | { error: string }> {
  return loadDocumentLayoutForModule("SALES_ORDER", input);
}

export async function loadSalesInvoiceDocumentLayout(input: {
  viewContext: DocumentViewContext;
  scope?: DocumentLayoutScope;
}): Promise<{ layout: DocumentLayoutTemplate } | { error: string }> {
  return loadDocumentLayoutForModule("SALES_INVOICE", input);
}

export async function saveSalesQuotationDocumentLayout(
  input: SaveDocumentLayoutInput
): Promise<{ success: true } | { error: string }> {
  return saveDocumentLayoutForModule(
    "SALES_QUOTATION",
    normalizeSalesQuotationLayoutTemplate,
    ["/settings/modules/sales", "/sales/quotes"],
    input
  );
}

export async function saveSalesOrderDocumentLayout(
  input: SaveDocumentLayoutInput
): Promise<{ success: true } | { error: string }> {
  return saveDocumentLayoutForModule(
    "SALES_ORDER",
    normalizeSalesOrderLayoutTemplate,
    ["/settings/modules/sales", "/sales/orders"],
    input
  );
}

export async function saveSalesInvoiceDocumentLayout(
  input: SaveDocumentLayoutInput
): Promise<{ success: true } | { error: string }> {
  return saveDocumentLayoutForModule(
    "SALES_INVOICE",
    normalizeSalesInvoiceLayoutTemplate,
    ["/settings/modules/sales", "/sales/invoices"],
    input
  );
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

const salesApprovalRuleSchema = z.object({
  type: z.enum(["LINE_QTY_ABOVE", "LINE_PRICE_BELOW_LIST", "LINE_DISCOUNT_ABOVE"]),
  enabled: z.boolean(),
  threshold: z.number().nonnegative().nullable().optional(),
  tolerance_percent: z.number().nonnegative().nullable().optional(),
});

const salesDocumentApprovalSchema = z.object({
  require: z.boolean(),
  threshold_amount: z.number().nonnegative().nullable(),
  approver_user_ids: z.array(z.string().uuid()),
  approver_roles: z.array(z.enum(["ADMIN", "MANAGER"])).optional(),
  approval_rules: z.array(salesApprovalRuleSchema).optional(),
  workflow_template: z.enum(["standard", "manager_chain_finance", "custom"]).optional(),
  finance_approver_user_ids: z.array(z.string().uuid()).optional(),
  approval_bands: z.array(approvalPolicyBandSchema).optional(),
  approver_pools: z
    .record(
      z.string(),
      z.object({
        user_ids: z.array(z.string().uuid()),
        roles: z.array(z.enum(["ADMIN", "MANAGER"])).optional(),
      })
    )
    .optional(),
});

const saveSalesApprovalSettingsSchema = z.object({
  allow_submitter_self_approve_below_threshold: z.boolean(),
  so: salesDocumentApprovalSchema.extend({
    require: z.boolean(),
  }),
  quote: salesDocumentApprovalSchema.extend({
    require: z.boolean(),
  }),
  invoice: salesDocumentApprovalSchema.extend({
    require: z.boolean(),
  }),
});

function toDocumentPatch(
  prefix: "so" | "quote" | "invoice",
  requireKey:
    | "require_so_approval_before_confirm"
    | "require_quote_approval_before_confirm"
    | "require_invoice_approval_before_post",
  doc: z.infer<typeof salesDocumentApprovalSchema>
) {
  const approverRoles = doc.approver_roles ?? [];
  const defaultPool = {
    user_ids: doc.approver_user_ids,
    roles: approverRoles,
  };

  return {
    [requireKey]: doc.require,
    [`${prefix}_approval_threshold_amount`]: doc.threshold_amount,
    [`${prefix}_approver_user_ids`]: doc.approver_user_ids,
    [`${prefix}_approver_roles`]: approverRoles,
    [`${prefix}_approval_rules`]: doc.approval_rules ?? [],
    [`${prefix}_workflow_template`]: doc.workflow_template ?? "standard",
    [`${prefix}_finance_approver_user_ids`]: doc.finance_approver_user_ids ?? [],
    [`${prefix}_approval_bands`]: doc.approval_bands ?? [],
    [`${prefix}_approver_pools`]: doc.approver_pools ?? {
      default: defaultPool,
    },
  };
}

function normalizeIncomingSettings(raw: SalesApprovalSettings) {
  return {
    allow_submitter_self_approve_below_threshold: raw.allow_submitter_self_approve_below_threshold,
    so: {
      require: raw.require_so_approval_before_confirm,
      threshold_amount: raw.so_approval_threshold_amount,
      approver_user_ids: raw.so_approver_user_ids,
      approver_roles: raw.so_approver_roles ?? [],
      approval_rules: raw.so_approval_rules ?? [],
      workflow_template: raw.so_workflow_template ?? "standard",
      finance_approver_user_ids: raw.so_finance_approver_user_ids ?? [],
      approval_bands: raw.so_approval_bands ?? [],
      approver_pools: raw.so_approver_pools,
    },
    quote: {
      require: raw.require_quote_approval_before_confirm,
      threshold_amount: raw.quote_approval_threshold_amount,
      approver_user_ids: raw.quote_approver_user_ids,
      approver_roles: raw.quote_approver_roles ?? [],
      approval_rules: raw.quote_approval_rules ?? [],
      workflow_template: raw.quote_workflow_template ?? "standard",
      finance_approver_user_ids: raw.quote_finance_approver_user_ids ?? [],
      approval_bands: raw.quote_approval_bands ?? [],
      approver_pools: raw.quote_approver_pools,
    },
    invoice: {
      require: raw.require_invoice_approval_before_post,
      threshold_amount: raw.invoice_approval_threshold_amount,
      approver_user_ids: raw.invoice_approver_user_ids,
      approver_roles: raw.invoice_approver_roles ?? [],
      approval_rules: raw.invoice_approval_rules ?? [],
      workflow_template: raw.invoice_workflow_template ?? "standard",
      finance_approver_user_ids: raw.invoice_finance_approver_user_ids ?? [],
      approval_bands: raw.invoice_approval_bands ?? [],
      approver_pools: raw.invoice_approver_pools,
    },
  };
}

export async function saveSalesApprovalSettings(
  raw: SalesApprovalSettings
): Promise<{ success: true } | { error: string }> {
  try {
    const parsed = saveSalesApprovalSettingsSchema.safeParse(normalizeIncomingSettings(raw));
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid approval settings." };
    }

    const { supabase, tenantId, userId } = await requireTenantId();
    const access = await resolveOrganizationSettingsAccess(supabase, userId, tenantId);
    if (!access.granted) {
      return { error: "You do not have permission to edit approval settings." };
    }

    const { error } = await supabase.rpc("upsert_tenant_workspace_control", {
      p_registry_key: "APPROVAL_SETTINGS",
      p_metadata_patch: {
        allow_submitter_self_approve_below_threshold:
          parsed.data.allow_submitter_self_approve_below_threshold,
        ...toDocumentPatch("so", "require_so_approval_before_confirm", parsed.data.so),
        ...toDocumentPatch("quote", "require_quote_approval_before_confirm", parsed.data.quote),
        ...toDocumentPatch("invoice", "require_invoice_approval_before_post", parsed.data.invoice),
      },
    });

    if (error) {
      if (isMissingRpcError(error)) {
        return { error: formatRpcDeployError("upsert_tenant_workspace_control") };
      }
      return { error: error.message };
    }

    revalidatePath("/settings/modules/sales");
    revalidatePath("/sales/orders");
    revalidatePath("/sales/quotes");
    revalidatePath("/sales/invoices");
    revalidatePath("/sales");
    revalidatePath("/dashboard");
    revalidatePath("/approvals");

    return { success: true as const };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to save approval settings.",
    };
  }
}

const saveSalesPoliciesSchema = z.object({
  document_conversion_mode: z.enum(SALES_DOCUMENT_CONVERSION_MODES),
});

export async function saveSalesPolicies(raw: unknown) {
  try {
    const parsed = saveSalesPoliciesSchema.safeParse(raw);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid sales policies." };
    }

    const { supabase, tenantId, userId } = await requireTenantId();
    const access = await resolveOrganizationSettingsAccess(supabase, userId, tenantId);
    if (!access.granted) {
      return { error: "You do not have permission to edit sales policies." };
    }

    const { error } = await supabase.rpc("upsert_tenant_workspace_control", {
      p_registry_key: "SALES_SETTINGS",
      p_metadata_patch: {
        document_conversion_mode: parsed.data.document_conversion_mode,
      },
    });

    if (error) {
      if (isMissingRpcError(error)) {
        return { error: formatRpcDeployError("upsert_tenant_workspace_control") };
      }
      return { error: error.message };
    }

    revalidatePath("/settings/modules/sales");
    revalidatePath("/sales/orders");
    revalidatePath("/sales/quotes");
    revalidatePath("/sales/invoices");
    revalidatePath("/sales");

    return { success: true as const };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to save sales policies.",
    };
  }
}
