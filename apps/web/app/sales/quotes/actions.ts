"use server";

import { revalidatePath } from "next/cache";
import { lookupStockVariantBySku } from "@/app/inventory/stock/actions";
import { fetchSalesLocationLabel } from "@/lib/sales/shared/queries";
import {
  fetchSalesQuotationById,
  fetchSalesQuotationsPage,
} from "@/lib/sales/quotes/queries";
import { mapSalesCommerceLineToRpcPayload } from "@/lib/sales/shared/sales-commerce-line-rpc";
import { formatSalesQuoteRpcError } from "@/lib/sales/quotes/rpc-errors";
import {
  approveSalesQuotationSchema,
  confirmSalesQuotationSchema,
  convertQuotationSchema,
  rejectSalesQuotationSchema,
  saveSalesQuotationSchema,
  sendSalesQuotationSchema,
  submitSalesQuotationForApprovalSchema,
} from "@/lib/sales/quotes/schemas";
import {
  resolveCustomerEmailForQuote,
  sendQuotationEmailForQuote,
} from "@/lib/sales/quotes/send-quotation-email";
import type { SalesQuoteRow } from "@/lib/sales/quotes/types";
import { parseSalesQuotationWorkflowRpcResult } from "@/lib/documents/posting-queries";
import { mapSalesQuoteToSoDraft } from "@/lib/sales/orders/draft-form";
import { SALES_INVOICES_HREF, SALES_ORDERS_HREF, SALES_QUOTES_HREF } from "@/lib/sales/navigation";
import { mapSalesCommerceRpcExtrasInput } from "@/lib/sales/shared/sales-commerce-save-extras";
import { resolveSalesCommerceSupplyStatesServer } from "@/lib/sales/shared/resolve-sales-supply-states-server";
import { formatRpcDeployError, isMissingRpcError } from "@/lib/supabase/rpc-error";
import { requireTenantMutation, type TenantContext } from "@/lib/supabase/require-tenant";
import { z } from "zod";
import {
  canAccessSalesOrderShippingLocation,
  resolveSalesOrderEditAccess,
} from "@/lib/sales/access";
import {
  canUserApproveSalesQuotes,
  isSalesQuoteApprovableByUser,
} from "@/lib/sales/approval-settings";
import { fetchSalesApprovalSettings } from "@/lib/sales/approval-settings-server";

const QUOTE_PATHS = [SALES_QUOTES_HREF, SALES_ORDERS_HREF, SALES_INVOICES_HREF, "/sales", "/dashboard"] as const;

function revalidateQuotePaths() {
  for (const path of QUOTE_PATHS) {
    revalidatePath(path);
  }
}

export async function fetchMoreSalesQuotations(offset: number) {
  const { supabase, tenantId } = await requireTenantMutation();
  return fetchSalesQuotationsPage(supabase, tenantId, { offset });
}

export async function loadSalesQuotations(): Promise<SalesQuoteRow[]> {
  const page = await fetchMoreSalesQuotations(0);
  return page.rows;
}

export async function loadSalesQuotationDetail(
  quotationId: string
): Promise<{ quote: SalesQuoteRow } | { error: string }> {
  const parsed = z.string().uuid().safeParse(quotationId);
  if (!parsed.success) return { error: "Invalid quotation id." };

  const { supabase, tenantId } = await requireTenantMutation();
  try {
    const quote = await fetchSalesQuotationById(supabase, tenantId, parsed.data);
    if (!quote) return { error: "Quote not found." };
    return { quote };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to load quote detail.",
    };
  }
}

export async function resolveQuoteLineSku(sku: string) {
  return lookupStockVariantBySku(sku);
}

async function quoteErrorContext(
  supabase: TenantContext["supabase"],
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

export async function saveSalesQuotation(raw: unknown) {
  const rawRecord =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null;
  if (!rawRecord) {
    return { error: "Invalid quote." };
  }

  const { supabase, userId, tenantId } = await requireTenantMutation();
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

  const parsed = saveSalesQuotationSchema.safeParse({
    ...rawRecord,
    billing_state: resolvedStates.billing_state,
    shipping_state: resolvedStates.shipping_state,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid quote." };
  }

  const values = parsed.data;
  const errorContext = await quoteErrorContext(supabase, tenantId, values.origin_location_id);

  const { data, error } = await supabase.rpc("save_sales_quotation", {
    p_sales_quotation_id: values.sales_quotation_id ?? null,
    p_customer_id: values.customer_id,
    p_lines: values.lines.map((line) =>
      mapSalesCommerceLineToRpcPayload(line, Number(line.quantity_quoted))
    ),
    p_created_by: userId,
    p_billing_state: values.billing_state,
    p_shipping_state: values.shipping_state,
    p_valid_until: values.valid_until,
    p_origin_location_id: values.origin_location_id ?? null,
    p_custom_fields: values.custom_fields,
    ...mapSalesCommerceRpcExtrasInput(values),
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("save_sales_quotation") };
    }
    return { error: formatSalesQuoteRpcError(error.message, errorContext).message };
  }

  const quotationId = data as string;
  revalidateQuotePaths();
  return { success: true as const, quotationId };
}

export async function submitSalesQuotationForApproval(raw: unknown) {
  const parsed = submitSalesQuotationForApprovalSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid quote." };
  }

  return runSalesQuotationWorkflowRpc("submit_sales_quotation_for_approval", {
    p_quotation_id: parsed.data.quotation_id,
  });
}

async function runSalesQuotationWorkflowRpc(
  rpcName:
    | "submit_sales_quotation_for_approval"
    | "approve_sales_quotation"
    | "reject_sales_quotation"
    | "confirm_sales_quotation"
    | "send_sales_quotation",
  args: Record<string, unknown>,
  options?: { revalidate?: boolean }
): Promise<
  | { success: true; quotationId: string; pendingNextStep?: boolean }
  | { error: string }
> {
  const { supabase } = await requireTenantMutation();
  const { data, error } = await supabase.rpc(rpcName, args);

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError(rpcName) };
    }
    return { error: formatSalesQuoteRpcError(error.message).message };
  }

  if (options?.revalidate !== false) {
    revalidateQuotePaths();
    revalidatePath("/dashboard");
  }

  const parsedResult = parseSalesQuotationWorkflowRpcResult(data);
  if (!parsedResult) {
    return { error: "Action completed but the response was invalid." };
  }

  return {
    success: true as const,
    quotationId: parsedResult.quotationId,
    pendingNextStep: parsedResult.pendingNextStep,
  };
}

export async function confirmSalesQuotation(raw: unknown) {
  const parsed = confirmSalesQuotationSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid quote." };
  }

  return runSalesQuotationWorkflowRpc("confirm_sales_quotation", {
    p_quotation_id: parsed.data.quotation_id,
  });
}

export async function sendSalesQuotation(raw: unknown) {
  const parsed = sendSalesQuotationSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid quote." };
  }

  const { supabase, tenantId, email } = await requireTenantMutation();
  const quotationId = parsed.data.quotation_id;
  const sendChannel = parsed.data.send_channel ?? "EMAIL";

  const quote = await fetchSalesQuotationById(supabase, tenantId, quotationId);
  if (!quote) {
    return { error: "Quote not found." };
  }

  let sentToEmail: string | null = null;

  if (sendChannel === "EMAIL") {
    sentToEmail =
      parsed.data.sent_to_email?.trim() ||
      (await resolveCustomerEmailForQuote(supabase, tenantId, quote.customer_id));

    if (!sentToEmail) {
      return { error: "Enter a recipient email or add one on the customer record." };
    }

    const senderName = quote.created_by_name?.trim() || email?.trim() || "Sales team";
    const emailResult = await sendQuotationEmailForQuote({
      supabase,
      tenantId,
      quotationId,
      sentToEmail,
      senderName,
    });

    if (!emailResult.success) {
      return {
        error: emailResult.error,
        notConfigured: emailResult.notConfigured,
      };
    }
  }

  return runSalesQuotationWorkflowRpc("send_sales_quotation", {
    p_quotation_id: quotationId,
    p_sent_to_email: sentToEmail,
    p_send_channel: sendChannel,
  });
}

export async function approveSalesQuotation(raw: unknown) {
  const parsed = approveSalesQuotationSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid quote." };
  }

  return runSalesQuotationWorkflowRpc("approve_sales_quotation", {
    p_quotation_id: parsed.data.quotation_id,
    p_notes: parsed.data.notes ?? null,
  });
}

export async function rejectSalesQuotation(raw: unknown) {
  const parsed = rejectSalesQuotationSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid quote." };
  }

  return runSalesQuotationWorkflowRpc("reject_sales_quotation", {
    p_quotation_id: parsed.data.quotation_id,
    p_notes: parsed.data.notes,
  });
}

const bulkApproveSalesQuotationsSchema = z.object({
  quotation_ids: z.array(z.string().uuid()).min(1),
});

export async function bulkApproveSalesQuotations(raw: unknown) {
  const parsed = bulkApproveSalesQuotationsSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid bulk approval request." };
  }

  const uniqueIds = [...new Set(parsed.data.quotation_ids)];
  const { supabase, tenantId, userId } = await requireTenantMutation();
  const [access, approvalSettings] = await Promise.all([
    resolveSalesOrderEditAccess(supabase, userId, tenantId),
    fetchSalesApprovalSettings(supabase, tenantId),
  ]);

  if (!canUserApproveSalesQuotes(userId, approvalSettings, { isOwner: access.isOwner })) {
    return { error: "You do not have permission to approve quotes." };
  }

  const { data: quotes, error: fetchError } = await supabase
    .from("sales_quotations")
    .select("id, commercial_status, total_net_amount, origin_location_id")
    .eq("tenant_id", tenantId)
    .in("id", uniqueIds);

  if (fetchError) {
    return { error: "Unable to load quotes for approval." };
  }

  const quoteById = new Map((quotes ?? []).map((row) => [row.id as string, row]));
  const pendingIds = uniqueIds.filter(
    (id) => quoteById.get(id)?.commercial_status === "PENDING_APPROVAL"
  );

  const submitterByQuoteId = new Map<string, string | null>();
  if (pendingIds.length > 0) {
    const { data: approvalRequests } = await supabase
      .from("document_approval_requests")
      .select("document_id, submitted_by")
      .eq("tenant_id", tenantId)
      .eq("document_type", "SALES_QUOTATION")
      .eq("status", "PENDING")
      .in("document_id", pendingIds);

    for (const request of approvalRequests ?? []) {
      submitterByQuoteId.set(
        request.document_id as string,
        (request.submitted_by as string | null) ?? null
      );
    }
  }

  const approvedIds: string[] = [];
  const pendingNextStepIds: string[] = [];
  const failures: Array<{ id: string; error: string }> = [];

  for (const quotationId of uniqueIds) {
    const quote = quoteById.get(quotationId);
    if (!quote) {
      failures.push({ id: quotationId, error: "Quote not found." });
      continue;
    }

    if (
      quote.origin_location_id &&
      !canAccessSalesOrderShippingLocation(quote.origin_location_id as string, {
        locationScope: access.locationScope,
      })
    ) {
      failures.push({ id: quotationId, error: "You do not have access to this quote." });
      continue;
    }

    if (quote.commercial_status !== "PENDING_APPROVAL") {
      failures.push({
        id: quotationId,
        error: "Only pending-approval quotes can be approved.",
      });
      continue;
    }

    if (!access.isOwner) {
      const approvalSubmittedBy = submitterByQuoteId.get(quotationId) ?? null;
      const quotePayload = {
        commercial_status: quote.commercial_status as string,
        total_net_amount: quote.total_net_amount as string | number,
        approval_submitted_by: approvalSubmittedBy,
      };

      if (
        !isSalesQuoteApprovableByUser(quotePayload, userId, approvalSettings, { isOwner: false })
      ) {
        failures.push({
          id: quotationId,
          error: "This quote cannot be approved by you.",
        });
        continue;
      }
    }

    const result = await runSalesQuotationWorkflowRpc(
      "approve_sales_quotation",
      {
        p_quotation_id: quotationId,
        p_notes: null,
      },
      { revalidate: false }
    );

    if ("error" in result) {
      failures.push({ id: quotationId, error: result.error });
      continue;
    }

    approvedIds.push(result.quotationId);
    if (result.pendingNextStep) {
      pendingNextStepIds.push(result.quotationId);
    }
  }

  if (approvedIds.length > 0) {
    revalidateQuotePaths();
    revalidatePath("/dashboard");
  }

  if (approvedIds.length === 0) {
    return {
      error: failures[0]?.error ?? "Unable to approve the selected quotes.",
    };
  }

  return {
    success: true as const,
    approvedIds,
    pendingNextStepIds,
    failures,
  };
}

export async function resolveQuoteSendRecipientEmail(quotationId: string) {
  const parsed = z.string().uuid().safeParse(quotationId);
  if (!parsed.success) return { error: "Invalid quotation id." };

  const { supabase, tenantId } = await requireTenantMutation();
  const quote = await fetchSalesQuotationById(supabase, tenantId, parsed.data);
  if (!quote) return { error: "Quote not found." };

  const email = await resolveCustomerEmailForQuote(supabase, tenantId, quote.customer_id);
  return { email };
}

export async function convertQuotationToOrder(raw: unknown) {
  const parsed = convertQuotationSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid quote." };
  }

  const { supabase } = await requireTenantMutation();
  const { data, error } = await supabase.rpc("convert_quotation_to_order", {
    p_quotation_id: parsed.data.quotation_id,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("convert_quotation_to_order") };
    }
    return { error: formatSalesQuoteRpcError(error.message).message };
  }

  revalidateQuotePaths();
  return { success: true as const, salesOrderId: data as string };
}

export async function convertQuotationToInvoice(raw: unknown) {
  const parsed = convertQuotationSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid quote." };
  }

  const { supabase } = await requireTenantMutation();
  const { data, error } = await supabase.rpc("convert_quotation_to_invoice", {
    p_quotation_id: parsed.data.quotation_id,
    p_origin_location_id: parsed.data.origin_location_id ?? null,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("convert_quotation_to_invoice") };
    }
    return { error: formatSalesQuoteRpcError(error.message).message };
  }

  revalidateQuotePaths();
  revalidatePath(SALES_INVOICES_HREF);
  return { success: true as const, salesInvoiceId: data as string };
}

export async function loadSalesOrderPrefillFromQuote(quotationId: string) {
  const parsed = z.string().uuid().safeParse(quotationId);
  if (!parsed.success) return { error: "Invalid quotation id." };

  const { supabase, tenantId } = await requireTenantMutation();
  try {
    const quote = await fetchSalesQuotationById(supabase, tenantId, parsed.data);
    if (!quote) return { error: "Quotation not found." };
    return { draft: mapSalesQuoteToSoDraft(quote), quote };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to load quotation prefill.",
    };
  }
}
