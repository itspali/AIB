"use server";

import { revalidatePath } from "next/cache";
import { lookupStockVariantBySku } from "@/app/inventory/stock/actions";
import { fetchSalesOrderById } from "@/lib/sales/orders/queries";
import { mapSalesOrderToInvoiceDraft } from "@/lib/sales/invoices/draft-form";
import {
  fetchInvoicePaymentApplications,
  fetchSalesInvoiceById,
  fetchSalesInvoices,
} from "@/lib/sales/invoices/queries";
import { mapInvoiceLinesToRpcPayload } from "@/lib/sales/invoices/draft-form";
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

export async function loadSalesInvoices(): Promise<SalesInvoiceRow[]> {
  const { supabase, tenantId } = await requireTenantId();
  return fetchSalesInvoices(supabase, tenantId);
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
    p_lines: mapInvoiceLinesToRpcPayload(
      values.lines.map((line) => ({
        key: line.variant_id,
        sku: "",
        variant_id: line.variant_id,
        item_id: "",
        item_name: "",
        variant_sku: "",
        quantity_invoiced: line.quantity_invoiced,
        unit_price_selling: line.unit_price_selling,
        discount_percentage: line.discount_percentage,
        discount_amount: line.discount_amount,
        source_order_line_id: line.source_order_line_id ?? null,
        skuError: null,
      }))
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
