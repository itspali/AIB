"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fetchDocumentLayoutTemplate, upsertDocumentLayoutTemplate } from "@/lib/documents/document-layout-queries";
import { layoutScopeKey, type DocumentLayoutScope } from "@/lib/documents/layout-scope";
import { normalizePoLayoutTemplate } from "@/lib/documents/purchase-order-layout";
import type { DocumentLayoutTemplate, DocumentViewContext } from "@/lib/documents/types";
import { resolveOrganizationSettingsAccess } from "@/lib/organization/access";
import {
  PO_AUTO_ROUND_OFF_STEP_PRESETS,
  resolvePoAutoRoundOffStep,
} from "@/lib/procurement/purchase-orders/po-auto-round-off";
import { requireTenantId } from "@/lib/supabase/require-tenant";
import { formatRpcDeployError, isMissingRpcError } from "@/lib/supabase/rpc-error";

export type SavePurchaseOrderDocumentLayoutInput = {
  scope: DocumentLayoutScope;
  viewContext: DocumentViewContext;
  layout: DocumentLayoutTemplate;
};

function resolveScopeLocationId(scope: DocumentLayoutScope): string | null {
  return scope.mode === "location" ? scope.locationId : null;
}

export async function loadPurchaseOrderDocumentLayout(input: {
  viewContext: DocumentViewContext;
  scope?: DocumentLayoutScope;
}): Promise<{ layout: DocumentLayoutTemplate } | { error: string }> {
  try {
    const { supabase, tenantId } = await requireTenantId();
    const layout = await fetchDocumentLayoutTemplate(
      supabase,
      tenantId,
      "PURCHASE_ORDER",
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

export async function savePurchaseOrderDocumentLayout(
  input: SavePurchaseOrderDocumentLayoutInput
): Promise<{ success: true } | { error: string }> {
  try {
    const { supabase, tenantId, userId } = await requireTenantId();
    const access = await resolveOrganizationSettingsAccess(supabase, userId, tenantId);
    if (!access.granted) {
      return { error: "You do not have permission to edit document layout." };
    }

    const layout = normalizePoLayoutTemplate({
      ...input.layout,
      moduleKey: "PURCHASE_ORDER",
      viewContext: input.viewContext,
    });

    if (layout.moduleKey !== "PURCHASE_ORDER") {
      return { error: "Invalid module for purchase order layout." };
    }

    void layoutScopeKey(input.scope);

    await upsertDocumentLayoutTemplate(supabase, tenantId, layout, {
      locationId: resolveScopeLocationId(input.scope),
    });

    revalidatePath("/settings/modules/procurement");
    revalidatePath("/procurement/purchase-orders");

    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to save document layout.",
    };
  }
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
  allow_zero_cost_receipts: z.boolean(),
  promo_default_category: z.string().trim().min(1).max(64),
  landed_cost_allocation_method: z.enum(["BY_QUANTITY", "BY_VALUE", "BY_WEIGHT"]),
  absorb_sunk_logistics_overhead: z.boolean(),
  matching_tolerance_percentage: z.number().min(0).max(100),
});

export async function saveProcurementPolicies(raw: unknown) {
  try {
    const parsed = saveProcurementPoliciesSchema.safeParse(raw);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid procurement policies." };
    }

    const { supabase, tenantId, userId } = await requireTenantId();
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
        allow_zero_cost_receipts: parsed.data.allow_zero_cost_receipts,
        promo_default_category: parsed.data.promo_default_category,
        landed_cost_allocation_method: parsed.data.landed_cost_allocation_method,
        absorb_sunk_logistics_overhead: parsed.data.absorb_sunk_logistics_overhead,
        matching_tolerance_percentage: parsed.data.matching_tolerance_percentage,
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

    return { success: true as const };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to save procurement policies.",
    };
  }
}
