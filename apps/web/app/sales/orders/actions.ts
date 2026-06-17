"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  lookupStockVariantBySku,
  searchStockVariantsForAdjustment,
} from "@/app/inventory/stock/actions";
import { parseSalesOrderWorkflowRpcResult } from "@/lib/documents/posting-queries";
import type { PostingStepResult } from "@/lib/documents/posting-types";
import type { UserFacingErrorAction } from "@/lib/errors/user-facing-error";
import {
  canAccessSalesOrderShippingLocation,
  resolveSalesOrderEditAccess,
} from "@/lib/sales/access";
import {
  canUserApproveSalesOrders,
  describeSalesOrderSelfApprovalBlocker,
  isSalesOrderApprovableByUser,
  isSalesOrderConfirmableByUser,
} from "@/lib/sales/approval-settings";
import { fetchSalesApprovalSettings } from "@/lib/sales/approval-settings-server";
import {
  fetchSalesOrderById,
  fetchSalesOrders,
} from "@/lib/sales/orders/queries";
import { formatSalesOrderRpcError } from "@/lib/sales/orders/rpc-errors";
import {
  approveSalesOrderSchema,
  amendConfirmedSalesOrderSchema,
  cancelSalesOrderSchema,
  confirmSalesOrderSchema,
  peekSalesOrderNumberSchema,
  rejectSalesOrderSchema,
  saveSalesOrderSchema,
  submitSalesOrderForApprovalSchema,
  updateSalesOrderVoucherNumberSchema,
} from "@/lib/sales/orders/schemas";
import { salesOrderFetchOptionsForScope } from "@/lib/sales/orders/fetch-scope";
import type { SalesOrderRow } from "@/lib/sales/orders/types";
import {
  fetchSalesCustomers,
  fetchSalesLocationLabel,
  fetchSalesLocations,
} from "@/lib/sales/shared/queries";
import { mapSalesCommerceRpcExtrasInput } from "@/lib/sales/shared/sales-commerce-save-extras";
import { mapSalesCommerceLineToRpcPayload } from "@/lib/sales/shared/sales-commerce-line-rpc";
import { resolveSalesCommerceSupplyStatesServer } from "@/lib/sales/shared/resolve-sales-supply-states-server";
import type { CustomerOption, SalesLocationOption } from "@/lib/sales/shared/types";
import { formatRpcDeployError, isMissingRpcError } from "@/lib/supabase/rpc-error";
import { requireTenantId } from "@/lib/supabase/require-tenant";
import { fetchApprovalWorkflowCompleteByDocumentId } from "@/lib/sales/shared/approval-list-hydration";

const SO_PATHS = [
  "/sales/orders",
  "/sales",
  "/dashboard",
  "/inventory/stock",
  "/fulfillment/shipping",
] as const;

function revalidateSalesOrderPaths() {
  for (const path of SO_PATHS) {
    revalidatePath(path);
  }
}

export async function loadSalesLocations(): Promise<SalesLocationOption[]> {
  const { supabase, tenantId } = await requireTenantId();
  return fetchSalesLocations(supabase, tenantId);
}

export async function loadSalesCustomers(): Promise<CustomerOption[]> {
  const { supabase, tenantId } = await requireTenantId();
  return fetchSalesCustomers(supabase, tenantId);
}

export async function loadSalesOrders(): Promise<SalesOrderRow[]> {
  const { supabase, tenantId, userId } = await requireTenantId();
  const access = await resolveSalesOrderEditAccess(supabase, userId, tenantId);
  return fetchSalesOrders(
    supabase,
    tenantId,
    salesOrderFetchOptionsForScope(access.locationScope)
  );
}

export async function loadSalesOrderDetail(
  salesOrderId: string
): Promise<{ salesOrder: SalesOrderRow } | { error: string }> {
  if (!salesOrderId.trim()) return { error: "Sales order id is required." };
  const { supabase, tenantId, userId } = await requireTenantId();
  const [salesOrder, access] = await Promise.all([
    fetchSalesOrderById(supabase, tenantId, salesOrderId),
    resolveSalesOrderEditAccess(supabase, userId, tenantId),
  ]);
  if (!salesOrder) return { error: "Sales order not found." };
  if (
    salesOrder.shipping_location_id &&
    !canAccessSalesOrderShippingLocation(salesOrder.shipping_location_id, access)
  ) {
    return { error: "Sales order not found." };
  }
  return { salesOrder };
}

export async function peekSalesOrderNumber(raw: unknown) {
  const parsed = peekSalesOrderNumberSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid location." };
  }

  const { supabase, tenantId } = await requireTenantId();
  const { data, error } = await supabase.rpc("peek_document_voucher_string", {
    p_voucher_type: "SALES_ORDER",
    p_location_id: parsed.data.shipping_location_id,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("peek_document_voucher_string") };
    }

    const locationMeta = await fetchSalesLocationLabel(
      supabase,
      tenantId,
      parsed.data.shipping_location_id
    );

    const formatted = formatSalesOrderRpcError(error.message, {
      locationId: parsed.data.shipping_location_id,
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

export async function saveSalesOrder(raw: unknown) {
  const rawRecord =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null;
  if (!rawRecord) {
    return { error: "Invalid sales order." };
  }

  const { supabase, tenantId, userId } = await requireTenantId();
  const resolvedStates = await resolveSalesCommerceSupplyStatesServer(supabase, tenantId, {
    customerId: typeof rawRecord.customer_id === "string" ? rawRecord.customer_id : "",
    originLocationId:
      typeof rawRecord.shipping_location_id === "string" ? rawRecord.shipping_location_id : null,
    billingState: typeof rawRecord.billing_state === "string" ? rawRecord.billing_state : "",
    shippingState: typeof rawRecord.shipping_state === "string" ? rawRecord.shipping_state : "",
  });
  if ("error" in resolvedStates) {
    return { error: resolvedStates.error };
  }

  const parsed = saveSalesOrderSchema.safeParse({
    ...rawRecord,
    billing_state: resolvedStates.billing_state,
    shipping_state: resolvedStates.shipping_state,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid sales order." };
  }

  const values = parsed.data;

  const { data, error } = await supabase.rpc("save_sales_order", {
    p_sales_order_id: values.sales_order_id ?? null,
    p_customer_id: values.customer_id,
    p_shipping_location_id: values.shipping_location_id,
    p_billing_state: values.billing_state,
    p_shipping_state: values.shipping_state,
    p_source_quotation_id: values.source_quotation_id ?? null,
    p_custom_fields: values.custom_fields,
    p_lines: values.lines.map((line) =>
      mapSalesCommerceLineToRpcPayload(line, Number(line.quantity_ordered), {
        source_quotation_line_id: line.source_quotation_line_id ?? null,
      })
    ),
    p_created_by: userId,
    ...mapSalesCommerceRpcExtrasInput(values),
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("save_sales_order") };
    }

    const { supabase: client, tenantId } = await requireTenantId();
    const locationMeta = await fetchSalesLocationLabel(
      client,
      tenantId,
      values.shipping_location_id
    );

    const formatted = formatSalesOrderRpcError(error.message, {
      locationId: values.shipping_location_id,
      locationName: locationMeta?.locationName,
      locationCode: locationMeta?.locationCode,
    });

    return {
      error: formatted.message,
      errorAction: formatted.action,
    };
  }

  revalidateSalesOrderPaths();
  return { success: true as const, salesOrderId: data as string };
}

export async function amendConfirmedSalesOrder(raw: unknown) {
  const rawRecord =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null;
  if (!rawRecord) {
    return { error: "Invalid sales order." };
  }

  const { supabase, tenantId, userId } = await requireTenantId();
  const resolvedStates = await resolveSalesCommerceSupplyStatesServer(supabase, tenantId, {
    customerId: typeof rawRecord.customer_id === "string" ? rawRecord.customer_id : "",
    originLocationId:
      typeof rawRecord.shipping_location_id === "string" ? rawRecord.shipping_location_id : null,
    billingState: typeof rawRecord.billing_state === "string" ? rawRecord.billing_state : "",
    shippingState: typeof rawRecord.shipping_state === "string" ? rawRecord.shipping_state : "",
  });
  if ("error" in resolvedStates) {
    return { error: resolvedStates.error };
  }

  const parsed = amendConfirmedSalesOrderSchema.safeParse({
    ...rawRecord,
    billing_state: resolvedStates.billing_state,
    shipping_state: resolvedStates.shipping_state,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid sales order." };
  }

  const values = parsed.data;

  const { data, error } = await supabase.rpc("amend_confirmed_sales_order", {
    p_sales_order_id: values.sales_order_id,
    p_customer_id: values.customer_id,
    p_billing_state: values.billing_state,
    p_shipping_state: values.shipping_state,
    p_lines: values.lines.map((line) => ({
      ...mapSalesCommerceLineToRpcPayload(line, Number(line.quantity_ordered), {
        source_quotation_line_id: line.source_quotation_line_id ?? null,
      }),
      id: line.id ?? null,
    })),
    p_custom_fields: values.custom_fields,
    ...mapSalesCommerceRpcExtrasInput(values),
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("amend_confirmed_sales_order") };
    }

    const locationMeta = values.shipping_location_id
      ? await fetchSalesLocationLabel(supabase, tenantId, values.shipping_location_id)
      : null;

    const formatted = formatSalesOrderRpcError(error.message, {
      locationId: values.shipping_location_id,
      locationName: locationMeta?.locationName,
      locationCode: locationMeta?.locationCode,
    });

    return {
      error: formatted.message,
      errorAction: formatted.action,
    };
  }

  revalidateSalesOrderPaths();
  return { success: true as const, salesOrderId: data as string };
}

export async function cancelSalesOrder(raw: unknown) {
  const parsed = cancelSalesOrderSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid sales order." };
  }

  const { supabase } = await requireTenantId();
  const { data, error } = await supabase.rpc("cancel_sales_order", {
    p_sales_order_id: parsed.data.sales_order_id,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("cancel_sales_order") };
    }
    const formatted = formatSalesOrderRpcError(error.message);
    return {
      error: formatted.message,
      errorAction: formatted.action,
    };
  }

  revalidateSalesOrderPaths();
  return {
    success: true as const,
    salesOrderId: (data as { sales_order_id?: string })?.sales_order_id ?? parsed.data.sales_order_id,
  };
}

export async function updateSalesOrderVoucherNumber(raw: unknown) {
  const parsed = updateSalesOrderVoucherNumberSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid SO number." };
  }

  const { supabase } = await requireTenantId();

  const { data, error } = await supabase.rpc("update_sales_order_voucher_number", {
    p_sales_order_id: parsed.data.sales_order_id,
    p_voucher_number: parsed.data.voucher_number,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("update_sales_order_voucher_number") };
    }

    const formatted = formatSalesOrderRpcError(error.message);
    return { error: formatted.message };
  }

  revalidateSalesOrderPaths();
  return {
    success: true as const,
    salesOrderId: data as string,
    voucherNumber: parsed.data.voucher_number,
  };
}

async function runSalesOrderWorkflowRpc(
  rpcName:
    | "submit_sales_order_for_approval"
    | "approve_sales_order"
    | "reject_sales_order"
    | "confirm_sales_order",
  args: Record<string, unknown>,
  options?: { revalidate?: boolean }
): Promise<
  | {
      success: true;
      salesOrderId: string;
      steps: PostingStepResult[];
      confirmed?: boolean;
      pendingNextStep?: boolean;
    }
  | { error: string; errorAction?: UserFacingErrorAction }
> {
  const { supabase } = await requireTenantId();
  const { data, error } = await supabase.rpc(rpcName, args);

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError(rpcName) };
    }
    const formatted = formatSalesOrderRpcError(error.message);
    return {
      error: formatted.message,
      errorAction: formatted.action,
    };
  }

  if (options?.revalidate !== false) {
    revalidateSalesOrderPaths();
    revalidatePath("/dashboard");
  }

  const parsedResult = parseSalesOrderWorkflowRpcResult(data);
  if (!parsedResult) {
    return { error: "Action completed but the response was invalid." };
  }

  return {
    success: true as const,
    salesOrderId: parsedResult.salesOrderId,
    steps: parsedResult.steps,
    confirmed: parsedResult.confirmed,
    pendingNextStep: parsedResult.pendingNextStep,
  };
}

export async function submitSalesOrderForApproval(raw: unknown) {
  const parsed = submitSalesOrderForApprovalSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid sales order." };
  }

  return runSalesOrderWorkflowRpc("submit_sales_order_for_approval", {
    p_sales_order_id: parsed.data.sales_order_id,
  });
}

export async function approveSalesOrder(raw: unknown) {
  const parsed = approveSalesOrderSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid sales order." };
  }

  return runSalesOrderWorkflowRpc("approve_sales_order", {
    p_sales_order_id: parsed.data.sales_order_id,
    p_notes: parsed.data.notes ?? null,
  });
}

export async function rejectSalesOrder(raw: unknown) {
  const parsed = rejectSalesOrderSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid rejection request." };
  }

  return runSalesOrderWorkflowRpc("reject_sales_order", {
    p_sales_order_id: parsed.data.sales_order_id,
    p_notes: parsed.data.notes,
  });
}

export async function confirmSalesOrder(raw: unknown) {
  const parsed = confirmSalesOrderSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid sales order." };
  }

  return runSalesOrderWorkflowRpc("confirm_sales_order", {
    p_sales_order_id: parsed.data.sales_order_id,
  });
}

const bulkApproveSalesOrdersSchema = z.object({
  sales_order_ids: z.array(z.string().uuid()).min(1),
});

export async function bulkApproveSalesOrders(raw: unknown) {
  const parsed = bulkApproveSalesOrdersSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid bulk approval request." };
  }

  const uniqueIds = [...new Set(parsed.data.sales_order_ids)];
  const { supabase, tenantId, userId } = await requireTenantId();
  const [access, approvalSettings] = await Promise.all([
    resolveSalesOrderEditAccess(supabase, userId, tenantId),
    fetchSalesApprovalSettings(supabase, tenantId),
  ]);

  if (!canUserApproveSalesOrders(userId, approvalSettings, { isOwner: access.isOwner })) {
    return { error: "You do not have permission to approve sales orders." };
  }

  const { data: orders, error: fetchError } = await supabase
    .from("sales_orders")
    .select("id, commercial_status, total_net_amount, shipping_location_id")
    .eq("tenant_id", tenantId)
    .in("id", uniqueIds);

  if (fetchError) {
    return { error: "Unable to load sales orders for approval." };
  }

  const orderById = new Map((orders ?? []).map((row) => [row.id as string, row]));
  const pendingIds = uniqueIds.filter(
    (id) => orderById.get(id)?.commercial_status === "PENDING_APPROVAL"
  );

  const submitterBySoId = new Map<string, string | null>();
  if (pendingIds.length > 0) {
    const { data: approvalRequests } = await supabase
      .from("document_approval_requests")
      .select("document_id, submitted_by")
      .eq("tenant_id", tenantId)
      .eq("document_type", "SALES_ORDER")
      .eq("status", "PENDING")
      .in("document_id", pendingIds);

    for (const request of approvalRequests ?? []) {
      submitterBySoId.set(
        request.document_id as string,
        (request.submitted_by as string | null) ?? null
      );
    }
  }

  const approvedIds: string[] = [];
  const failures: Array<{ id: string; error: string }> = [];

  for (const salesOrderId of uniqueIds) {
    const order = orderById.get(salesOrderId);
    if (!order) {
      failures.push({ id: salesOrderId, error: "Sales order not found." });
      continue;
    }

    if (
      order.shipping_location_id &&
      !canAccessSalesOrderShippingLocation(order.shipping_location_id as string, {
        locationScope: access.locationScope,
      })
    ) {
      failures.push({ id: salesOrderId, error: "You do not have access to this sales order." });
      continue;
    }

    if (order.commercial_status !== "PENDING_APPROVAL") {
      failures.push({
        id: salesOrderId,
        error: "Only pending-approval sales orders can be approved.",
      });
      continue;
    }

    if (!access.isOwner) {
      const approvalSubmittedBy = submitterBySoId.get(salesOrderId) ?? null;
      const amount = Number(order.total_net_amount);
      const orderPayload = {
        commercial_status: order.commercial_status as string,
        total_net_amount: order.total_net_amount as string | number,
        approval_submitted_by: approvalSubmittedBy,
      };

      if (
        !isSalesOrderApprovableByUser(orderPayload, userId, approvalSettings, { isOwner: false })
      ) {
        const selfApprovalBlocker =
          approvalSubmittedBy === userId
            ? describeSalesOrderSelfApprovalBlocker(
                approvalSettings,
                amount,
                userId,
                { isOwner: false }
              )
            : null;

        failures.push({
          id: salesOrderId,
          error: selfApprovalBlocker ?? "This sales order cannot be approved by you.",
        });
        continue;
      }
    }

    const result = await runSalesOrderWorkflowRpc(
      "approve_sales_order",
      {
        p_sales_order_id: salesOrderId,
        p_notes: null,
      },
      { revalidate: false }
    );

    if ("error" in result) {
      failures.push({ id: salesOrderId, error: result.error });
      continue;
    }

    approvedIds.push(result.salesOrderId);
  }

  if (approvedIds.length > 0) {
    revalidateSalesOrderPaths();
    revalidatePath("/dashboard");
  }

  if (approvedIds.length === 0) {
    return {
      error: failures[0]?.error ?? "Unable to approve the selected sales orders.",
    };
  }

  return {
    success: true as const,
    approvedIds,
    failures,
  };
}

const bulkConfirmSalesOrdersSchema = z.object({
  sales_order_ids: z.array(z.string().uuid()).min(1),
});

export async function bulkConfirmSalesOrders(raw: unknown) {
  const parsed = bulkConfirmSalesOrdersSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid bulk confirmation request." };
  }

  const uniqueIds = [...new Set(parsed.data.sales_order_ids)];
  const { supabase, tenantId, userId } = await requireTenantId();
  const [access, approvalSettings] = await Promise.all([
    resolveSalesOrderEditAccess(supabase, userId, tenantId),
    fetchSalesApprovalSettings(supabase, tenantId),
  ]);

  if (!access.granted) {
    return { error: "You do not have permission to confirm sales orders." };
  }

  const { data: orders, error: fetchError } = await supabase
    .from("sales_orders")
    .select("id, commercial_status, total_net_amount, shipping_location_id")
    .eq("tenant_id", tenantId)
    .in("id", uniqueIds);

  if (fetchError) {
    return { error: "Unable to load sales orders for confirmation." };
  }

  const orderById = new Map((orders ?? []).map((row) => [row.id as string, row]));

  const { data: lineRows } = await supabase
    .from("sales_order_items")
    .select("sales_order_id")
    .eq("tenant_id", tenantId)
    .in("sales_order_id", uniqueIds);

  const lineCountBySoId = new Map<string, number>();
  for (const row of lineRows ?? []) {
    const id = row.sales_order_id as string;
    lineCountBySoId.set(id, (lineCountBySoId.get(id) ?? 0) + 1);
  }

  const pendingIds = uniqueIds.filter(
    (id) => orderById.get(id)?.commercial_status === "PENDING_APPROVAL"
  );

  const workflowCompleteIds =
    pendingIds.length > 0
      ? await fetchApprovalWorkflowCompleteByDocumentId(
          supabase,
          tenantId,
          "SALES_ORDER",
          pendingIds
        )
      : new Set<string>();

  const confirmedIds: string[] = [];
  const failures: Array<{ id: string; error: string }> = [];

  for (const salesOrderId of uniqueIds) {
    const order = orderById.get(salesOrderId);
    if (!order) {
      failures.push({ id: salesOrderId, error: "Sales order not found." });
      continue;
    }

    if (
      order.shipping_location_id &&
      !canAccessSalesOrderShippingLocation(order.shipping_location_id as string, {
        locationScope: access.locationScope,
      })
    ) {
      failures.push({ id: salesOrderId, error: "You do not have access to this sales order." });
      continue;
    }

    const orderPayload = {
      commercial_status: order.commercial_status as string,
      total_net_amount: order.total_net_amount as string | number,
      line_count: lineCountBySoId.get(salesOrderId) ?? 0,
      approval_workflow_complete: workflowCompleteIds.has(salesOrderId),
    };

    if (
      !isSalesOrderConfirmableByUser(orderPayload, approvalSettings, userId, {
        isOwner: access.isOwner,
        editAccessGranted: access.granted,
      })
    ) {
      failures.push({
        id: salesOrderId,
        error: "This sales order cannot be confirmed.",
      });
      continue;
    }

    const result = await runSalesOrderWorkflowRpc(
      "confirm_sales_order",
      { p_sales_order_id: salesOrderId },
      { revalidate: false }
    );

    if ("error" in result) {
      failures.push({ id: salesOrderId, error: result.error });
      continue;
    }

    confirmedIds.push(result.salesOrderId);
  }

  if (confirmedIds.length > 0) {
    revalidateSalesOrderPaths();
    revalidatePath("/dashboard");
  }

  if (confirmedIds.length === 0) {
    return {
      error: failures[0]?.error ?? "Unable to confirm the selected sales orders.",
    };
  }

  return {
    success: true as const,
    confirmedIds,
    failures,
  };
}

export { searchStockVariantsForAdjustment, lookupStockVariantBySku };
