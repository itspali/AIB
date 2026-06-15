"use server";

import { revalidatePath } from "next/cache";
import { lookupStockVariantBySku } from "@/app/inventory/stock/actions";
import { fetchSalesLocationLabel } from "@/lib/sales/shared/queries";
import {
  fetchSalesQuotationById,
  fetchSalesQuotations,
} from "@/lib/sales/quotes/queries";
import { mapQuoteLinesToRpcPayload } from "@/lib/sales/quotes/draft-form";
import { formatSalesQuoteRpcError } from "@/lib/sales/quotes/rpc-errors";
import {
  approveSalesQuotationSchema,
  convertQuotationSchema,
  rejectSalesQuotationSchema,
  saveSalesQuotationSchema,
  submitSalesQuotationForApprovalSchema,
} from "@/lib/sales/quotes/schemas";
import type { SalesQuoteRow } from "@/lib/sales/quotes/types";
import { SALES_INVOICES_HREF, SALES_ORDERS_HREF, SALES_QUOTES_HREF } from "@/lib/sales/navigation";
import { mapSalesCommerceRpcExtrasInput } from "@/lib/sales/shared/sales-commerce-save-extras";
import { resolveSalesCommerceSupplyStatesServer } from "@/lib/sales/shared/resolve-sales-supply-states-server";
import { formatRpcDeployError, isMissingRpcError } from "@/lib/supabase/rpc-error";
import { requireTenantId } from "@/lib/supabase/require-tenant";
import { z } from "zod";

const QUOTE_PATHS = [SALES_QUOTES_HREF, SALES_ORDERS_HREF, SALES_INVOICES_HREF, "/sales", "/dashboard"] as const;

function revalidateQuotePaths() {
  for (const path of QUOTE_PATHS) {
    revalidatePath(path);
  }
}

export async function loadSalesQuotations(): Promise<SalesQuoteRow[]> {
  const { supabase, tenantId } = await requireTenantId();
  return fetchSalesQuotations(supabase, tenantId);
}

export async function loadSalesQuotationDetail(
  quotationId: string
): Promise<{ quote: SalesQuoteRow } | { error: string }> {
  const parsed = z.string().uuid().safeParse(quotationId);
  if (!parsed.success) return { error: "Invalid quotation id." };

  const { supabase, tenantId } = await requireTenantId();
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

export async function saveSalesQuotation(raw: unknown) {
  const rawRecord =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null;
  if (!rawRecord) {
    return { error: "Invalid quote." };
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
    p_lines: mapQuoteLinesToRpcPayload(
      values.lines.map((line) => ({
        key: line.variant_id,
        sku: "",
        variant_id: line.variant_id,
        item_id: "",
        item_name: "",
        variant_sku: "",
        quantity_quoted: line.quantity_quoted,
        unit_price_selling: line.unit_price_selling,
        discount_percentage: line.discount_percentage,
        discount_amount: line.discount_amount,
        skuError: null,
      }))
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

  const { supabase } = await requireTenantId();
  const { error } = await supabase.rpc("submit_sales_quotation_for_approval", {
    p_quotation_id: parsed.data.quotation_id,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("submit_sales_quotation_for_approval") };
    }
    return { error: formatSalesQuoteRpcError(error.message).message };
  }

  revalidateQuotePaths();
  return { success: true as const, quotationId: parsed.data.quotation_id };
}

export async function approveSalesQuotation(raw: unknown) {
  const parsed = approveSalesQuotationSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid quote." };
  }

  const { supabase } = await requireTenantId();
  const { error } = await supabase.rpc("approve_sales_quotation", {
    p_quotation_id: parsed.data.quotation_id,
    p_notes: parsed.data.notes ?? null,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("approve_sales_quotation") };
    }
    return { error: formatSalesQuoteRpcError(error.message).message };
  }

  revalidateQuotePaths();
  return { success: true as const, quotationId: parsed.data.quotation_id };
}

export async function rejectSalesQuotation(raw: unknown) {
  const parsed = rejectSalesQuotationSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid quote." };
  }

  const { supabase } = await requireTenantId();
  const { error } = await supabase.rpc("reject_sales_quotation", {
    p_quotation_id: parsed.data.quotation_id,
    p_notes: parsed.data.notes,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("reject_sales_quotation") };
    }
    return { error: formatSalesQuoteRpcError(error.message).message };
  }

  revalidateQuotePaths();
  return { success: true as const, quotationId: parsed.data.quotation_id };
}

export async function convertQuotationToOrder(raw: unknown) {
  const parsed = convertQuotationSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid quote." };
  }

  const { supabase } = await requireTenantId();
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

  const { supabase } = await requireTenantId();
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
