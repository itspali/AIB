"use server";

import { revalidatePath } from "next/cache";
import {
  fetchPurchaseOrderById,
  fetchPurchaseOrdersPage,
} from "@/lib/procurement/purchase-orders/queries";
import { resolveEffectiveDocumentLayout } from "@/lib/documents/resolve-effective-document-layout";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";
import type { PurchaseOrderRow } from "@/lib/procurement/purchase-orders/types";
import { purchaseOrderFetchOptionsForScope } from "@/lib/procurement/purchase-orders/fetch-scope";
import {
  canAccessPurchaseOrderDestination,
  resolvePurchaseOrderEditAccess,
} from "@/lib/procurement/access";
import { formatPurchaseOrderRpcError } from "@/lib/procurement/purchase-orders/rpc-errors";
import { serializePurchaseOrderCustomFields } from "@/lib/procurement/purchase-orders/custom-fields";
import { normalizePoHeaderChargesForSave } from "@/lib/procurement/purchase-orders/po-header-charges";
import {
  approvePurchaseOrderSchema,
  bulkApprovePurchaseOrdersSchema,
  issuePurchaseOrderSchema,
  peekPurchaseOrderNumberSchema,
  rejectPurchaseOrderSchema,
  savePurchaseOrderSchema,
  submitPurchaseOrderForApprovalSchema,
  supplierItemInsightsSchema,
  updatePurchaseOrderVoucherNumberSchema,
} from "@/lib/procurement/purchase-orders/schemas";
import { fetchSupplierVariantPrice } from "@/lib/procurement/purchase-orders/supplier-price";
import {
  fetchSupplierItemInsights,
  type PoSupplierItemInsights,
} from "@/lib/procurement/purchase-orders/supplier-item-insights";
import {
  fetchPoLineCatalogContext,
  type PoLineCatalogContext,
} from "@/lib/procurement/purchase-orders/catalog-context";
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
import { assignPromoGroups, validatePoPromoLines } from "@/lib/procurement/purchase-orders/po-promo";
import type { UserFacingErrorAction } from "@/lib/errors/user-facing-error";
import { parseIssuePurchaseOrderRpcResult } from "@/lib/documents/posting-queries";
import type { PostingStepResult } from "@/lib/documents/posting-types";
import { formatRpcDeployError, isMissingRpcError } from "@/lib/supabase/rpc-error";
import { requireTenantMutation } from "@/lib/supabase/require-tenant";
import { assertFinanceSetupReady } from "@/app/onboarding/actions";
import { fetchPoPromoEntitlements, type PoPromoEntitlementRow } from "@/lib/procurement/promo/entitlements";
import { poPeekShowsPromoEntitlements } from "@/lib/procurement/purchase-orders/po-peek-promo";
import { normalizePoLayoutTemplate } from "@/lib/documents/purchase-order-layout";
import { z } from "zod";
import {
  canUserApprovePurchaseOrders,
  describePurchaseOrderSelfApprovalBlocker,
  isPurchaseOrderApprovableByUser,
} from "@/lib/procurement/approval-settings";
import { fetchProcurementApprovalSettings } from "@/lib/procurement/approval-settings-server";
import {
  loadItemWritebackProfile,
  mergeWritebackCustomFields,
} from "@/lib/procurement/purchase-orders/po-catalog-writeback-server";

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
  const { supabase, tenantId } = await requireTenantMutation();
  return fetchProcurementLocations(supabase, tenantId);
}

export async function loadProcurementSuppliers(): Promise<ProcurementSupplierOption[]> {
  const { supabase, tenantId } = await requireTenantMutation();
  return fetchProcurementSuppliers(supabase, tenantId);
}

export async function loadEffectivePoDocumentLayout(
  documentLocationId?: string | null
): Promise<{ layout: DocumentLayoutTemplate } | { error: string }> {
  try {
    const { supabase, tenantId } = await requireTenantMutation();
    const layout = await resolveEffectiveDocumentLayout({
      supabase,
      tenantId,
      moduleKey: "PURCHASE_ORDER",
      viewContext: "SCREEN_GRID",
      documentLocationId,
    });
    return { layout };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to load document layout.",
    };
  }
}

export async function fetchMorePurchaseOrders(offset: number) {
  const { supabase, tenantId, userId } = await requireTenantMutation();
  const access = await resolvePurchaseOrderEditAccess(supabase, userId, tenantId);
  return fetchPurchaseOrdersPage(
    supabase,
    tenantId,
    { offset, ...purchaseOrderFetchOptionsForScope(access.locationScope) }
  );
}

export async function loadPurchaseOrders(): Promise<PurchaseOrderRow[]> {
  const page = await fetchMorePurchaseOrders(0);
  return page.rows;
}

export async function loadPurchaseOrderDetail(
  purchaseOrderId: string
): Promise<{ purchaseOrder: PurchaseOrderRow } | { error: string }> {
  if (!purchaseOrderId.trim()) return { error: "Purchase order id is required." };
  const { supabase, tenantId, userId } = await requireTenantMutation();
  const [purchaseOrder, access] = await Promise.all([
    fetchPurchaseOrderById(supabase, tenantId, purchaseOrderId),
    resolvePurchaseOrderEditAccess(supabase, userId, tenantId),
  ]);
  if (!purchaseOrder) return { error: "Purchase order not found." };
  if (
    !canAccessPurchaseOrderDestination(purchaseOrder.destination_location_id, access)
  ) {
    return { error: "Purchase order not found." };
  }
  return { purchaseOrder };
}

export type PurchaseOrderPeekPayload = {
  purchaseOrder: PurchaseOrderRow;
  promoEntitlements: PoPromoEntitlementRow[];
  documentLayout: DocumentLayoutTemplate;
};

/** Single round-trip payload for the PO peek drawer (detail, promos, location layout). */
export async function loadPurchaseOrderPeek(
  purchaseOrderId: string
): Promise<PurchaseOrderPeekPayload | { error: string }> {
  if (!purchaseOrderId.trim()) return { error: "Purchase order id is required." };

  const { supabase, tenantId, userId } = await requireTenantMutation();
  const [purchaseOrder, access] = await Promise.all([
    fetchPurchaseOrderById(supabase, tenantId, purchaseOrderId),
    resolvePurchaseOrderEditAccess(supabase, userId, tenantId),
  ]);

  if (!purchaseOrder) return { error: "Purchase order not found." };
  if (!canAccessPurchaseOrderDestination(purchaseOrder.destination_location_id, access)) {
    return { error: "Purchase order not found." };
  }

  const needsPromoEntitlements = poPeekShowsPromoEntitlements(purchaseOrder.document_status);
  const [promoEntitlements, documentLayout] = await Promise.all([
    needsPromoEntitlements
      ? fetchPoPromoEntitlements(supabase, tenantId, purchaseOrderId)
      : Promise.resolve([] as PoPromoEntitlementRow[]),
    resolveEffectiveDocumentLayout({
      supabase,
      tenantId,
      moduleKey: "PURCHASE_ORDER",
      viewContext: "SCREEN_GRID",
      documentLocationId: purchaseOrder.destination_location_id,
    }),
  ]);

  return {
    purchaseOrder,
    promoEntitlements,
    documentLayout: normalizePoLayoutTemplate(documentLayout),
  };
}

export async function peekPurchaseOrderNumber(raw: unknown) {
  const parsed = peekPurchaseOrderNumberSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid location." };
  }

  const { supabase, tenantId } = await requireTenantMutation();
  const { data, error } = await supabase.rpc("peek_document_voucher_string", {
    p_voucher_type: "PURCHASE_ORDER",
    p_location_id: parsed.data.destination_location_id,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("peek_document_voucher_string") };
    }

    const locationMeta = await fetchProcurementLocationLabel(
      supabase,
      tenantId,
      parsed.data.destination_location_id
    );

    const formatted = formatPurchaseOrderRpcError(error.message, {
      locationId: parsed.data.destination_location_id,
      locationName: locationMeta?.locationName,
      locationCode: locationMeta?.locationCode,
    });

    return {
      error: formatted.message,
      errorAction: formatted.action,
    };
  }

  return { voucherPreview: data as string };
}

export async function lookupPoLineCatalogContext(input: {
  variant_id: string;
}): Promise<{ context: PoLineCatalogContext | null } | { error: string }> {
  if (!input.variant_id.trim()) {
    return { context: null };
  }

  try {
    const { supabase, tenantId } = await requireTenantMutation();
    const context = await fetchPoLineCatalogContext(supabase, tenantId, input.variant_id);
    return { context };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to load item details." };
  }
}

export async function lookupSupplierVariantPrice(input: {
  supplier_id: string;
  variant_id: string;
}): Promise<{ unit_price: string | null } | { error: string }> {
  if (!input.supplier_id.trim() || !input.variant_id.trim()) {
    return { unit_price: null };
  }

  try {
    const { supabase, tenantId } = await requireTenantMutation();
    const unit_price = await fetchSupplierVariantPrice(
      supabase,
      tenantId,
      input.supplier_id,
      input.variant_id
    );
    return { unit_price };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to load supplier price." };
  }
}

export async function loadSupplierItemInsights(
  raw: unknown
): Promise<{ insights: PoSupplierItemInsights } | { error: string }> {
  const parsed = supplierItemInsightsSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid insights request." };
  }

  try {
    const { supabase, tenantId } = await requireTenantMutation();
    const insights = await fetchSupplierItemInsights(supabase, tenantId, {
      supplier_id: parsed.data.supplier_id,
      variant_id: parsed.data.variant_id,
      destination_location_id: parsed.data.destination_location_id,
      exclude_purchase_order_id: parsed.data.exclude_purchase_order_id,
    });
    if (!insights) {
      return { error: "Item not found." };
    }
    return { insights };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to load supplier item insights.",
    };
  }
}

export { searchStockVariantsForAdjustment, lookupStockVariantBySku };

export async function savePurchaseOrder(raw: unknown) {
  const parsed = savePurchaseOrderSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid purchase order." };
  }

  const values = parsed.data;
  const { supabase, tenantId, userId } = await requireTenantMutation();

  const isNewPurchaseOrder = !values.purchase_order_id;
  if (isNewPurchaseOrder) {
    const gate = await assertFinanceSetupReady(supabase, tenantId);
    if (gate.error) return { error: gate.error };
  }

  const headerCharges = normalizePoHeaderChargesForSave({
    shipping_amount: values.shipping_amount,
    shipping_tax_rate_pct: values.shipping_tax_rate_pct,
    shipping_tax_amount: values.shipping_tax_amount,
    shipping_tax_type: values.shipping_tax_type,
    round_off_amount: values.round_off_amount,
    additional_charges_amount: values.additional_charges_amount,
    transaction_discount_percentage: values.transaction_discount_percentage,
    transaction_discount_amount: values.transaction_discount_amount,
    transaction_discount_type: values.transaction_discount_type,
  });

  const { data, error } = await supabase.rpc("save_purchase_order", {
    p_purchase_order_id: values.purchase_order_id ?? null,
    p_destination_location_id: values.destination_location_id,
    p_supplier_id: values.supplier_id,
    p_lines: values.lines.map((line) => ({
      variant_id: line.variant_id,
      quantity_ordered: Number(line.quantity_ordered),
      unit_price_contractual: Number(line.unit_price_contractual || 0),
      discount_percentage: Number(line.discount_percentage || 0),
      discount_amount: Number(line.discount_amount || 0),
      ...(line.uom_code ? { uom_code: line.uom_code } : {}),
      ...(line.is_promotional || Number(line.unit_price_contractual) === 0
        ? {
            is_promotional: true,
            ...(line.linked_parent_variant_id
              ? { linked_parent_variant_id: line.linked_parent_variant_id }
              : {}),
            promo_group_id: line.promo_group_id ?? null,
            promotional_category: line.promotional_category ?? null,
          }
        : {}),
    })),
    p_created_by: userId,
    p_payment_terms_days: Number(values.payment_terms_days || 0),
    p_custom_fields: serializePurchaseOrderCustomFields(values.custom_fields),
    p_currency_code: values.currency_code,
    p_prices_tax_inclusive: values.prices_tax_inclusive,
    p_shipping_amount: headerCharges.shipping_amount,
    p_shipping_tax_rate_pct: headerCharges.shipping_tax_rate_pct,
    p_shipping_tax_amount: headerCharges.shipping_tax_amount,
    p_shipping_tax_type: headerCharges.shipping_tax_type,
    p_round_off_amount: headerCharges.round_off_amount,
    p_additional_charges_amount: headerCharges.additional_charges_amount,
    p_transaction_discount_percentage: headerCharges.transaction_discount_percentage,
    p_transaction_discount_amount: headerCharges.transaction_discount_amount,
    p_transaction_discount_type: headerCharges.transaction_discount_type,
    p_receipt_location_id: values.receipt_location_id?.trim() || null,
    p_ultimate_destination_location_id:
      values.ultimate_destination_location_id?.trim() ||
      values.destination_location_id,
    p_po_fulfillment_stage_override: values.po_fulfillment_stage_override?.trim() || null,
    p_is_subcontract_job: values.is_subcontract_job ?? false,
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

export async function updatePurchaseOrderVoucherNumber(raw: unknown) {
  const parsed = updatePurchaseOrderVoucherNumberSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid PO number." };
  }

  const { supabase } = await requireTenantMutation();

  const { data, error } = await supabase.rpc("update_purchase_order_voucher_number", {
    p_purchase_order_id: parsed.data.purchase_order_id,
    p_voucher_number: parsed.data.voucher_number,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("update_purchase_order_voucher_number") };
    }

    const formatted = formatPurchaseOrderRpcError(error.message);
    return { error: formatted.message };
  }

  revalidatePurchaseOrderPaths();
  return {
    success: true as const,
    purchaseOrderId: data as string,
    voucherNumber: parsed.data.voucher_number,
  };
}

export async function issuePurchaseOrder(raw: unknown) {
  const parsed = issuePurchaseOrderSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid purchase order." };
  }

  const { supabase } = await requireTenantMutation();

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
  const parsedResult = parseIssuePurchaseOrderRpcResult(data);
  if (!parsedResult) {
    return { error: "Purchase order issued but the response was invalid." };
  }
  return {
    success: true as const,
    purchaseOrderId: parsedResult.purchaseOrderId,
    steps: parsedResult.steps,
  };
}

async function runPurchaseOrderWorkflowRpc(
  rpcName:
    | "submit_purchase_order_for_approval"
    | "approve_purchase_order"
    | "reject_purchase_order",
  args: Record<string, unknown>,
  options?: { revalidate?: boolean }
): Promise<
  | {
      success: true;
      purchaseOrderId: string;
      steps: PostingStepResult[];
      issued?: boolean;
      approved?: boolean;
      pendingNextStep?: boolean;
    }
  | { error: string; errorAction?: UserFacingErrorAction }
> {
  const { supabase } = await requireTenantMutation();
  const { data, error } = await supabase.rpc(rpcName, args);

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError(rpcName) };
    }
    const formatted = formatPurchaseOrderRpcError(error.message);
    return {
      error: formatted.message,
      errorAction: formatted.action,
    };
  }

  if (options?.revalidate !== false) {
    revalidatePurchaseOrderPaths();
    revalidatePath("/dashboard");
  }
  const parsedResult = parseIssuePurchaseOrderRpcResult(data);
  if (!parsedResult) {
    return { error: "Action completed but the response was invalid." };
  }
  return {
    success: true as const,
    purchaseOrderId: parsedResult.purchaseOrderId,
    steps: parsedResult.steps,
    issued: parsedResult.issued,
    approved: parsedResult.approved,
    pendingNextStep: parsedResult.pendingNextStep,
  };
}

export async function submitPurchaseOrderForApproval(raw: unknown) {
  const parsed = submitPurchaseOrderForApprovalSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid purchase order." };
  }

  return runPurchaseOrderWorkflowRpc("submit_purchase_order_for_approval", {
    p_purchase_order_id: parsed.data.purchase_order_id,
  });
}

export async function approvePurchaseOrder(raw: unknown) {
  const parsed = approvePurchaseOrderSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid purchase order." };
  }

  return runPurchaseOrderWorkflowRpc("approve_purchase_order", {
    p_purchase_order_id: parsed.data.purchase_order_id,
    p_notes: parsed.data.notes ?? null,
  });
}

export async function bulkApprovePurchaseOrders(raw: unknown) {
  const parsed = bulkApprovePurchaseOrdersSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid bulk approval request." };
  }

  const uniqueIds = [...new Set(parsed.data.purchase_order_ids)];
  const { supabase, tenantId, userId } = await requireTenantMutation();
  const [access, approvalSettings] = await Promise.all([
    resolvePurchaseOrderEditAccess(supabase, userId, tenantId),
    fetchProcurementApprovalSettings(supabase, tenantId),
  ]);

  if (
    !canUserApprovePurchaseOrders(userId, approvalSettings, { isOwner: access.isOwner })
  ) {
    return { error: "You do not have permission to approve purchase orders." };
  }

  const { data: orders, error: fetchError } = await supabase
    .from("purchase_orders")
    .select("id, document_status, total_net_amount, destination_location_id")
    .eq("tenant_id", tenantId)
    .in("id", uniqueIds);

  if (fetchError) {
    return { error: "Unable to load purchase orders for approval." };
  }

  const orderById = new Map((orders ?? []).map((row) => [row.id as string, row]));
  const pendingIds = uniqueIds.filter(
    (id) => orderById.get(id)?.document_status === "PENDING_APPROVAL"
  );

  const submitterByPoId = new Map<string, string | null>();
  if (pendingIds.length > 0) {
    const { data: approvalRequests } = await supabase
      .from("document_approval_requests")
      .select("document_id, submitted_by")
      .eq("tenant_id", tenantId)
      .eq("document_type", "PURCHASE_ORDER")
      .eq("status", "PENDING")
      .in("document_id", pendingIds);

    for (const request of approvalRequests ?? []) {
      submitterByPoId.set(
        request.document_id as string,
        (request.submitted_by as string | null) ?? null
      );
    }
  }

  const approvedIds: string[] = [];
  const failures: Array<{ id: string; error: string }> = [];

  for (const purchaseOrderId of uniqueIds) {
    const order = orderById.get(purchaseOrderId);
    if (!order) {
      failures.push({ id: purchaseOrderId, error: "Purchase order not found." });
      continue;
    }

    if (
      !canAccessPurchaseOrderDestination(order.destination_location_id as string, {
        locationScope: access.locationScope,
      })
    ) {
      failures.push({ id: purchaseOrderId, error: "You do not have access to this purchase order." });
      continue;
    }

    if (order.document_status !== "PENDING_APPROVAL") {
      failures.push({
        id: purchaseOrderId,
        error: "Only pending-approval purchase orders can be approved.",
      });
      continue;
    }

    if (!access.isOwner) {
      const approvalSubmittedBy = submitterByPoId.get(purchaseOrderId) ?? null;
      const amount = Number(order.total_net_amount);
      const orderPayload = {
        document_status: order.document_status as string,
        total_net_amount: order.total_net_amount as string | number,
        approval_submitted_by: approvalSubmittedBy,
      };

      if (
        !isPurchaseOrderApprovableByUser(
          orderPayload,
          userId,
          approvalSettings,
          { isOwner: false }
        )
      ) {
        const selfApprovalBlocker =
          approvalSubmittedBy === userId
            ? describePurchaseOrderSelfApprovalBlocker(
                approvalSettings,
                amount,
                userId,
                { isOwner: false }
              )
            : null;

        failures.push({
          id: purchaseOrderId,
          error:
            selfApprovalBlocker ??
            "This purchase order cannot be approved by you.",
        });
        continue;
      }
    }

    const result = await runPurchaseOrderWorkflowRpc(
      "approve_purchase_order",
      {
        p_purchase_order_id: purchaseOrderId,
        p_notes: null,
      },
      { revalidate: false }
    );

    if ("error" in result) {
      failures.push({ id: purchaseOrderId, error: result.error });
      continue;
    }

    approvedIds.push(result.purchaseOrderId);
  }

  if (approvedIds.length > 0) {
    revalidatePurchaseOrderPaths();
    revalidatePath("/dashboard");
  }

  if (approvedIds.length === 0) {
    return {
      error: failures[0]?.error ?? "Unable to approve the selected purchase orders.",
    };
  }

  return {
    success: true as const,
    approvedIds,
    failures,
  };
}

export async function rejectPurchaseOrder(raw: unknown) {
  const parsed = rejectPurchaseOrderSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid rejection request." };
  }

  return runPurchaseOrderWorkflowRpc("reject_purchase_order", {
    p_purchase_order_id: parsed.data.purchase_order_id,
    p_notes: parsed.data.notes,
  });
}

const applyPoCatalogWritebackSchema = z.object({
  supplier_id: z.string().uuid(),
  updates: z.array(
    z.object({
      item_id: z.string().uuid(),
      variant_id: z.string().uuid(),
      field: z.enum([
        "mrp",
        "purchase_price",
        "supplier_price",
        "purchase_uom",
        "hsn_sac_code",
        "tax_code",
      ]),
      value: z.string().trim().min(1),
    })
  ),
});

export async function applyPoCatalogWriteback(raw: unknown) {
  const parsed = applyPoCatalogWritebackSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid catalog write-back request." };
  }

  const { supplier_id, updates } = parsed.data;
  if (updates.length === 0) {
    return { success: true as const, updatedCount: 0 };
  }

  const { supabase, tenantId } = await requireTenantMutation();

  const grouped = new Map<
    string,
    {
      item_id: string;
      variant_id: string;
      mrp?: string;
      purchase_price?: string;
      supplier_price?: string;
      purchase_uom?: string;
      hsn_sac_code?: string;
      tax_code_id?: string;
    }
  >();

  for (const update of updates) {
    const key = `${update.item_id}:${update.variant_id}`;
    const row = grouped.get(key) ?? {
      item_id: update.item_id,
      variant_id: update.variant_id,
    };
    if (update.field === "mrp") row.mrp = update.value;
    if (update.field === "purchase_price") row.purchase_price = update.value;
    if (update.field === "supplier_price") row.supplier_price = update.value;
    if (update.field === "purchase_uom") row.purchase_uom = update.value;
    if (update.field === "hsn_sac_code") row.hsn_sac_code = update.value;
    if (update.field === "tax_code") row.tax_code_id = update.value;
    grouped.set(key, row);
  }

  let updatedCount = 0;

  for (const row of grouped.values()) {
    const profile = await loadItemWritebackProfile(
      supabase,
      tenantId,
      row.item_id,
      row.variant_id
    );
    if (!profile) {
      return { error: "One or more items could not be loaded for catalog update." };
    }

    if (row.purchase_uom) {
      const allowedBase = profile.base_unit_of_measure.trim();
      const allowedCodes = new Set([allowedBase]);
      const { data: alternateRows, error: alternateError } = await supabase
        .from("item_uoms")
        .select("uom_code")
        .eq("tenant_id", tenantId)
        .eq("item_id", row.item_id);

      if (alternateError) {
        return { error: alternateError.message };
      }

      for (const alternate of alternateRows ?? []) {
        const code = String(alternate.uom_code ?? "").trim();
        if (code) allowedCodes.add(code);
      }

      const nextUom = row.purchase_uom.trim();
      if (!allowedCodes.has(nextUom)) {
        return {
          error: `Purchase unit "${nextUom}" is not configured for ${profile.name}.`,
        };
      }
    }

    if (row.mrp || row.purchase_price || row.purchase_uom || row.hsn_sac_code || row.tax_code_id) {
      const custom_fields = mergeWritebackCustomFields(
        profile,
        row.mrp,
        row.purchase_price,
        row.purchase_uom
      );

      const { error } = await supabase.rpc("save_product_master_profile", {
        p_item_id: profile.item_id,
        p_name: profile.name,
        p_classification: profile.classification,
        p_base_uom: profile.base_unit_of_measure,
        p_category_id: profile.category_id,
        p_sku: profile.sku,
        p_description: profile.description,
        p_is_purchasable: profile.is_purchasable,
        p_is_salable: profile.is_salable,
        p_is_returnable: profile.is_returnable,
        p_default_tax_category: profile.default_tax_category,
        p_has_variants: false,
        p_custom_fields: custom_fields,
        p_item_type: profile.item_type,
        p_track_inventory: profile.track_inventory,
        p_costing_method: profile.costing_method,
        p_standard_cost: profile.standard_cost,
        p_tracking_mode: profile.tracking_mode,
        p_is_bundle: profile.is_bundle,
        p_tax_code_id: row.tax_code_id ?? profile.tax_code_id,
        p_hsn_sac_code: row.hsn_sac_code ?? profile.hsn_sac_code,
        p_purchase_price: row.purchase_price ? Number(row.purchase_price) : null,
        p_variant_strategy: profile.variant_strategy,
      });

      if (error) {
        return { error: error.message };
      }
      updatedCount += 1;
    }

    if (row.supplier_price) {
      const { data: existing, error: existingError } = await supabase
        .from("supplier_items")
        .select("supplier_part_number, minimum_order_quantity, lead_time_days, is_preferred")
        .eq("tenant_id", tenantId)
        .eq("supplier_id", supplier_id)
        .eq("item_id", row.item_id)
        .or(`variant_id.eq.${row.variant_id},variant_id.is.null`)
        .order("variant_id", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (existingError) {
        return { error: existingError.message };
      }

      const { error: supplierError } = await supabase.rpc("save_supplier_catalog_entries", {
        p_item_id: row.item_id,
        p_rows: [
          {
            variant_id: row.variant_id,
            supplier_id,
            supplier_price: Number(row.supplier_price),
            supplier_part_number: existing?.supplier_part_number ?? null,
            minimum_order_quantity: existing?.minimum_order_quantity ?? 1,
            lead_time_days: existing?.lead_time_days ?? null,
            is_preferred: existing?.is_preferred ?? false,
          },
        ],
      });

      if (supplierError) {
        if (isMissingRpcError(supplierError)) {
          return { error: formatRpcDeployError("save_supplier_catalog_entries") };
        }
        return { error: supplierError.message };
      }
      updatedCount += 1;
    }
  }

  revalidatePurchaseOrderPaths();
  revalidatePath("/items");
  return { success: true as const, updatedCount };
}

const writeOffPromoEntitlementSchema = z.object({
  entitlement_id: z.string().uuid(),
  reason: z.string().trim().min(1, "A reason is required to write off free goods."),
});

export async function loadPoPromoEntitlements(purchaseOrderId: string) {
  const parsed = z.string().uuid().safeParse(purchaseOrderId);
  if (!parsed.success) {
    return { error: "Invalid purchase order." as const };
  }

  const { supabase, tenantId } = await requireTenantMutation();

  try {
    const entitlements = await fetchPoPromoEntitlements(supabase, tenantId, parsed.data);
    return { entitlements };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load promotional entitlements.";
    return { error: message };
  }
}

export async function writeOffPromotionalEntitlement(raw: unknown) {
  const parsed = writeOffPromoEntitlementSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid write-off request." };
  }

  const { supabase } = await requireTenantMutation();
  const { entitlement_id, reason } = parsed.data;

  const { error } = await supabase.rpc("write_off_promotional_entitlement", {
    p_entitlement_id: entitlement_id,
    p_reason: reason,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("write_off_promotional_entitlement") };
    }
    return { error: formatPurchaseOrderRpcError(error.message) };
  }

  revalidatePurchaseOrderPaths();
  return { success: true as const };
}
