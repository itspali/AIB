"use server";

import { revalidatePath } from "next/cache";
import { lookupStockVariantBySku } from "@/app/inventory/stock/actions";
import { fetchSalesOrderById } from "@/lib/sales/orders/queries";
import { fetchSalesQuotationById } from "@/lib/sales/quotes/queries";
import { mapSalesOrderToInvoiceDraft, mapSalesQuoteToInvoiceDraft } from "@/lib/sales/invoices/draft-form";
import {
  fetchInvoicePaymentApplications,
  fetchSalesInvoiceById,
  fetchSalesInvoicesPage,
} from "@/lib/sales/invoices/queries";
import { mapSalesCommerceLineToRpcPayload } from "@/lib/sales/shared/sales-commerce-line-rpc";
import { formatSalesInvoiceRpcError } from "@/lib/sales/invoices/rpc-errors";
import {
  approveSalesInvoiceSchema,
  convertOrderToInvoiceSchema,
  postSalesInvoiceSchema,
  rejectSalesInvoiceSchema,
  saveSalesInvoiceSchema,
  submitSalesInvoiceForApprovalSchema,
} from "@/lib/sales/invoices/schemas";
import type { InvoicePaymentApplicationRow, SalesInvoiceRow } from "@/lib/sales/invoices/types";
import { SALES_INVOICES_HREF, SALES_PAYMENTS_HREF, SALES_QUOTES_HREF } from "@/lib/sales/navigation";
import { fetchSalesLocationLabel } from "@/lib/sales/shared/queries";
import { mapSalesCommerceRpcExtrasInput } from "@/lib/sales/shared/sales-commerce-save-extras";
import { resolveSalesCommerceSupplyStatesServer } from "@/lib/sales/shared/resolve-sales-supply-states-server";
import { formatRpcDeployError, isMissingRpcError } from "@/lib/supabase/rpc-error";
import { requireTenantId } from "@/lib/supabase/require-tenant";
import { z } from "zod";
import {
  canAccessSalesOrderShippingLocation,
  resolveSalesOrderEditAccess,
} from "@/lib/sales/access";
import {
  canUserApproveSalesInvoices,
  describeSalesOrderSelfApprovalBlocker,
  isSalesInvoiceApprovableByUser,
  isSalesInvoicePostableByUser,
} from "@/lib/sales/approval-settings";
import { fetchSalesApprovalSettings } from "@/lib/sales/approval-settings-server";
import { fetchApprovalWorkflowCompleteByDocumentId } from "@/lib/sales/shared/approval-list-hydration";

const INVOICE_PATHS = [
  SALES_INVOICES_HREF,
  SALES_PAYMENTS_HREF,
  SALES_QUOTES_HREF,
  "/sales",
  "/dashboard",
] as const;

function revalidateInvoicePaths() {
  for (const path of INVOICE_PATHS) {
    revalidatePath(path);
  }
}

export async function fetchMoreSalesInvoices(offset: number) {
  const { supabase, tenantId } = await requireTenantId();
  return fetchSalesInvoicesPage(supabase, tenantId, { offset });
}

export async function loadSalesInvoices(): Promise<SalesInvoiceRow[]> {
  const page = await fetchMoreSalesInvoices(0);
  return page.rows;
}

export async function loadSalesInvoiceDetail(
  salesInvoiceId: string
): Promise<{ invoice: SalesInvoiceRow } | { error: string }> {
  const parsed = z.string().uuid().safeParse(salesInvoiceId);
  if (!parsed.success) return { error: "Invalid invoice id." };

  const { supabase, tenantId } = await requireTenantId();
  try {
    const invoice = await fetchSalesInvoiceById(supabase, tenantId, parsed.data);
    if (!invoice) return { error: "Invoice not found." };
    return { invoice };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to load invoice detail.",
    };
  }
}

export async function loadInvoicePaymentApplications(
  salesInvoiceId: string
): Promise<{ applications: InvoicePaymentApplicationRow[] } | { error: string }> {
  const parsed = z.string().uuid().safeParse(salesInvoiceId);
  if (!parsed.success) return { error: "Invalid invoice id." };

  const { supabase, tenantId } = await requireTenantId();
  try {
    const applications = await fetchInvoicePaymentApplications(
      supabase,
      tenantId,
      parsed.data
    );
    return { applications };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Unable to load payment applications.",
    };
  }
}

export async function loadSalesInvoicePrefillFromOrder(salesOrderId: string) {
  const parsed = z.string().uuid().safeParse(salesOrderId);
  if (!parsed.success) return { error: "Invalid sales order id." };

  const { supabase, tenantId } = await requireTenantId();
  try {
    const order = await fetchSalesOrderById(supabase, tenantId, parsed.data);
    if (!order) return { error: "Sales order not found." };
    return { draft: mapSalesOrderToInvoiceDraft(order), order };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to load sales order prefill.",
    };
  }
}

export async function loadSalesInvoicePrefillFromQuote(quotationId: string) {
  const parsed = z.string().uuid().safeParse(quotationId);
  if (!parsed.success) return { error: "Invalid quotation id." };

  const { supabase, tenantId } = await requireTenantId();
  try {
    const quote = await fetchSalesQuotationById(supabase, tenantId, parsed.data);
    if (!quote) return { error: "Quotation not found." };
    return { draft: mapSalesQuoteToInvoiceDraft(quote), quote };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to load quotation prefill.",
    };
  }
}

export async function resolveInvoiceLineSku(sku: string) {
  return lookupStockVariantBySku(sku);
}

async function invoiceErrorContext(
  supabase: Awaited<ReturnType<typeof requireTenantId>>["supabase"],
  tenantId: string,
  originLocationId?: string | null
) {
  if (!originLocationId) return {};
  const label = await fetchSalesLocationLabel(supabase, tenantId, originLocationId);
  if (!label) return { locationId: originLocationId };
  return {
    locationId: label.locationId,
    locationName: label.locationName,
    locationCode: label.locationCode,
  };
}

export async function saveSalesInvoice(raw: unknown) {
  const rawRecord =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null;
  if (!rawRecord) {
    return { error: "Invalid invoice." };
  }

  const { supabase, userId, tenantId } = await requireTenantId();
  const resolvedStates = await resolveSalesCommerceSupplyStatesServer(supabase, tenantId, {
    customerId: typeof rawRecord.customer_id === "string" ? rawRecord.customer_id : "",
    originLocationId:
      typeof rawRecord.origin_location_id === "string" ? rawRecord.origin_location_id : null,
    billingState: typeof rawRecord.billing_state === "string" ? rawRecord.billing_state : "",
    shippingState: typeof rawRecord.shipping_state === "string" ? rawRecord.shipping_state : "",
  });
  if ("error" in resolvedStates) {
    return { error: resolvedStates.error };
  }

  const parsed = saveSalesInvoiceSchema.safeParse({
    ...rawRecord,
    billing_state: resolvedStates.billing_state,
    shipping_state: resolvedStates.shipping_state,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid invoice." };
  }

  const values = parsed.data;
  const errorContext = await invoiceErrorContext(supabase, tenantId, values.origin_location_id);

  const { data, error } = await supabase.rpc("save_sales_invoice", {
    p_sales_invoice_id: values.sales_invoice_id ?? null,
    p_customer_id: values.customer_id,
    p_origin_location_id: values.origin_location_id,
    p_lines: values.lines.map((line) =>
      mapSalesCommerceLineToRpcPayload(line, Number(line.quantity_invoiced), {
        source_order_line_id: line.source_order_line_id ?? null,
        source_quotation_line_id: line.source_quotation_line_id ?? null,
      })
    ),
    p_created_by: userId,
    p_billing_state: values.billing_state,
    p_shipping_state: values.shipping_state,
    p_source_order_id: values.source_order_id ?? null,
    p_source_quotation_id: values.source_quotation_id ?? null,
    p_custom_fields: values.custom_fields,
    ...mapSalesCommerceRpcExtrasInput(values),
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("save_sales_invoice") };
    }
    return { error: formatSalesInvoiceRpcError(error.message, errorContext).message };
  }

  const salesInvoiceId = data as string;
  revalidateInvoicePaths();
  return { success: true as const, salesInvoiceId };
}

export async function submitSalesInvoiceForApproval(raw: unknown) {
  const parsed = submitSalesInvoiceForApprovalSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid invoice." };
  }

  const { supabase } = await requireTenantId();
  const { error } = await supabase.rpc("submit_sales_invoice_for_approval", {
    p_sales_invoice_id: parsed.data.sales_invoice_id,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("submit_sales_invoice_for_approval") };
    }
    return { error: formatSalesInvoiceRpcError(error.message).message };
  }

  revalidateInvoicePaths();
  return { success: true as const, salesInvoiceId: parsed.data.sales_invoice_id };
}

export async function approveSalesInvoice(raw: unknown) {
  const parsed = approveSalesInvoiceSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid invoice." };
  }

  const { supabase } = await requireTenantId();
  const { error } = await supabase.rpc("approve_sales_invoice", {
    p_sales_invoice_id: parsed.data.sales_invoice_id,
    p_notes: parsed.data.notes ?? null,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("approve_sales_invoice") };
    }
    return { error: formatSalesInvoiceRpcError(error.message).message };
  }

  revalidateInvoicePaths();
  return { success: true as const, salesInvoiceId: parsed.data.sales_invoice_id };
}

export async function rejectSalesInvoice(raw: unknown) {
  const parsed = rejectSalesInvoiceSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid invoice." };
  }

  const { supabase } = await requireTenantId();
  const { error } = await supabase.rpc("reject_sales_invoice", {
    p_sales_invoice_id: parsed.data.sales_invoice_id,
    p_notes: parsed.data.notes,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("reject_sales_invoice") };
    }
    return { error: formatSalesInvoiceRpcError(error.message).message };
  }

  revalidateInvoicePaths();
  return { success: true as const, salesInvoiceId: parsed.data.sales_invoice_id };
}

export async function postSalesInvoice(raw: unknown) {
  const parsed = postSalesInvoiceSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid invoice." };
  }

  const { supabase } = await requireTenantId();
  const { error } = await supabase.rpc("post_sales_invoice", {
    p_sales_invoice_id: parsed.data.sales_invoice_id,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("post_sales_invoice") };
    }
    return { error: formatSalesInvoiceRpcError(error.message).message };
  }

  revalidateInvoicePaths();
  return { success: true as const, salesInvoiceId: parsed.data.sales_invoice_id };
}

const bulkApproveSalesInvoicesSchema = z.object({
  sales_invoice_ids: z.array(z.string().uuid()).min(1),
});

export async function bulkApproveSalesInvoices(raw: unknown) {
  const parsed = bulkApproveSalesInvoicesSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid bulk approval request." };
  }

  const uniqueIds = [...new Set(parsed.data.sales_invoice_ids)];
  const { supabase, tenantId, userId } = await requireTenantId();
  const [access, approvalSettings] = await Promise.all([
    resolveSalesOrderEditAccess(supabase, userId, tenantId),
    fetchSalesApprovalSettings(supabase, tenantId),
  ]);

  if (!canUserApproveSalesInvoices(userId, approvalSettings, { isOwner: access.isOwner })) {
    return { error: "You do not have permission to approve invoices." };
  }

  const { data: invoices, error: fetchError } = await supabase
    .from("sales_invoices")
    .select("id, commercial_status, total_net_amount, origin_location_id")
    .eq("tenant_id", tenantId)
    .in("id", uniqueIds);

  if (fetchError) {
    return { error: "Unable to load invoices for approval." };
  }

  const invoiceById = new Map((invoices ?? []).map((row) => [row.id as string, row]));
  const pendingIds = uniqueIds.filter(
    (id) => invoiceById.get(id)?.commercial_status === "PENDING_APPROVAL"
  );

  const submitterByInvoiceId = new Map<string, string | null>();
  if (pendingIds.length > 0) {
    const { data: approvalRequests } = await supabase
      .from("document_approval_requests")
      .select("document_id, submitted_by")
      .eq("tenant_id", tenantId)
      .eq("document_type", "SALES_INVOICE")
      .eq("status", "PENDING")
      .in("document_id", pendingIds);

    for (const request of approvalRequests ?? []) {
      submitterByInvoiceId.set(
        request.document_id as string,
        (request.submitted_by as string | null) ?? null
      );
    }
  }

  const approvedIds: string[] = [];
  const failures: Array<{ id: string; error: string }> = [];

  for (const salesInvoiceId of uniqueIds) {
    const invoice = invoiceById.get(salesInvoiceId);
    if (!invoice) {
      failures.push({ id: salesInvoiceId, error: "Invoice not found." });
      continue;
    }

    if (
      invoice.origin_location_id &&
      !canAccessSalesOrderShippingLocation(invoice.origin_location_id as string, {
        locationScope: access.locationScope,
      })
    ) {
      failures.push({ id: salesInvoiceId, error: "You do not have access to this invoice." });
      continue;
    }

    if (invoice.commercial_status !== "PENDING_APPROVAL") {
      failures.push({
        id: salesInvoiceId,
        error: "Only pending-approval invoices can be approved.",
      });
      continue;
    }

    if (!access.isOwner) {
      const approvalSubmittedBy = submitterByInvoiceId.get(salesInvoiceId) ?? null;
      const invoicePayload = {
        commercial_status: invoice.commercial_status as string,
        total_net_amount: invoice.total_net_amount as string | number,
        approval_submitted_by: approvalSubmittedBy,
      };

      if (
        !isSalesInvoiceApprovableByUser(invoicePayload, userId, approvalSettings, {
          isOwner: false,
        })
      ) {
        const selfApprovalBlocker =
          approvalSubmittedBy === userId
            ? describeSalesOrderSelfApprovalBlocker(
                approvalSettings,
                Number(invoice.total_net_amount),
                userId,
                { isOwner: false }
              )
            : null;

        failures.push({
          id: salesInvoiceId,
          error: selfApprovalBlocker ?? "This invoice cannot be approved by you.",
        });
        continue;
      }
    }

    const { error } = await supabase.rpc("approve_sales_invoice", {
      p_sales_invoice_id: salesInvoiceId,
      p_notes: null,
    });

    if (error) {
      if (isMissingRpcError(error)) {
        failures.push({ id: salesInvoiceId, error: formatRpcDeployError("approve_sales_invoice") });
      } else {
        failures.push({
          id: salesInvoiceId,
          error: formatSalesInvoiceRpcError(error.message).message,
        });
      }
      continue;
    }

    approvedIds.push(salesInvoiceId);
  }

  if (approvedIds.length > 0) {
    revalidateInvoicePaths();
    revalidatePath("/dashboard");
  }

  if (approvedIds.length === 0) {
    return {
      error: failures[0]?.error ?? "Unable to approve the selected invoices.",
    };
  }

  return {
    success: true as const,
    approvedIds,
    failures,
  };
}

const bulkPostSalesInvoicesSchema = z.object({
  sales_invoice_ids: z.array(z.string().uuid()).min(1),
});

export async function bulkPostSalesInvoices(raw: unknown) {
  const parsed = bulkPostSalesInvoicesSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid bulk post request." };
  }

  const uniqueIds = [...new Set(parsed.data.sales_invoice_ids)];
  const { supabase, tenantId, userId } = await requireTenantId();
  const [access, approvalSettings] = await Promise.all([
    resolveSalesOrderEditAccess(supabase, userId, tenantId),
    fetchSalesApprovalSettings(supabase, tenantId),
  ]);

  if (!access.granted) {
    return { error: "You do not have permission to post invoices." };
  }

  const { data: invoices, error: fetchError } = await supabase
    .from("sales_invoices")
    .select("id, commercial_status, total_net_amount, origin_location_id")
    .eq("tenant_id", tenantId)
    .in("id", uniqueIds);

  if (fetchError) {
    return { error: "Unable to load invoices for posting." };
  }

  const invoiceById = new Map((invoices ?? []).map((row) => [row.id as string, row]));

  const { data: lineRows } = await supabase
    .from("sales_invoice_items")
    .select("sales_invoice_id")
    .eq("tenant_id", tenantId)
    .in("sales_invoice_id", uniqueIds);

  const lineCountByInvoiceId = new Map<string, number>();
  for (const row of lineRows ?? []) {
    const id = row.sales_invoice_id as string;
    lineCountByInvoiceId.set(id, (lineCountByInvoiceId.get(id) ?? 0) + 1);
  }

  const pendingIds = uniqueIds.filter(
    (id) => invoiceById.get(id)?.commercial_status === "PENDING_APPROVAL"
  );

  const workflowCompleteIds =
    pendingIds.length > 0
      ? await fetchApprovalWorkflowCompleteByDocumentId(
          supabase,
          tenantId,
          "SALES_INVOICE",
          pendingIds
        )
      : new Set<string>();

  const postedIds: string[] = [];
  const failures: Array<{ id: string; error: string }> = [];

  for (const salesInvoiceId of uniqueIds) {
    const invoice = invoiceById.get(salesInvoiceId);
    if (!invoice) {
      failures.push({ id: salesInvoiceId, error: "Invoice not found." });
      continue;
    }

    if (
      invoice.origin_location_id &&
      !canAccessSalesOrderShippingLocation(invoice.origin_location_id as string, {
        locationScope: access.locationScope,
      })
    ) {
      failures.push({ id: salesInvoiceId, error: "You do not have access to this invoice." });
      continue;
    }

    const invoicePayload = {
      commercial_status: invoice.commercial_status as string,
      total_net_amount: invoice.total_net_amount as string | number,
      line_count: lineCountByInvoiceId.get(salesInvoiceId) ?? 0,
      approval_workflow_complete: workflowCompleteIds.has(salesInvoiceId),
    };

    if (
      !isSalesInvoicePostableByUser(invoicePayload, approvalSettings, userId, {
        isOwner: access.isOwner,
        editAccessGranted: access.granted,
      })
    ) {
      failures.push({
        id: salesInvoiceId,
        error: "This invoice cannot be posted.",
      });
      continue;
    }

    const { error } = await supabase.rpc("post_sales_invoice", {
      p_sales_invoice_id: salesInvoiceId,
    });

    if (error) {
      if (isMissingRpcError(error)) {
        failures.push({ id: salesInvoiceId, error: formatRpcDeployError("post_sales_invoice") });
      } else {
        failures.push({
          id: salesInvoiceId,
          error: formatSalesInvoiceRpcError(error.message).message,
        });
      }
      continue;
    }

    postedIds.push(salesInvoiceId);
  }

  if (postedIds.length > 0) {
    revalidateInvoicePaths();
    revalidatePath("/dashboard");
  }

  if (postedIds.length === 0) {
    return {
      error: failures[0]?.error ?? "Unable to post the selected invoices.",
    };
  }

  return {
    success: true as const,
    postedIds,
    failures,
  };
}

export async function convertOrderToInvoice(raw: unknown) {
  const parsed = convertOrderToInvoiceSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid sales order." };
  }

  const { supabase } = await requireTenantId();
  const { data, error } = await supabase.rpc("convert_order_to_invoice", {
    p_sales_order_id: parsed.data.sales_order_id,
    p_origin_location_id: parsed.data.origin_location_id,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("convert_order_to_invoice") };
    }
    return { error: formatSalesInvoiceRpcError(error.message).message };
  }

  revalidateInvoicePaths();
  return { success: true as const, salesInvoiceId: data as string };
}
