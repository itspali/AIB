"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { formatSalesInvoiceRpcError } from "@/lib/sales/invoices/rpc-errors";
import { formatSalesOrderRpcError } from "@/lib/sales/orders/rpc-errors";
import { formatSalesQuoteRpcError } from "@/lib/sales/quotes/rpc-errors";
import {
  SALES_INVOICES_HREF,
  SALES_ORDERS_HREF,
  SALES_QUOTES_HREF,
} from "@/lib/sales/navigation";
import { fetchInvoicesForSalesOrder } from "@/lib/sales/shared/related-documents";
import { formatRpcDeployError, isMissingRpcError } from "@/lib/supabase/rpc-error";
import { requireTenantId } from "@/lib/supabase/require-tenant";

const SALES_PATHS = [SALES_ORDERS_HREF, SALES_QUOTES_HREF, SALES_INVOICES_HREF, "/sales", "/dashboard"] as const;

function revalidateSalesPaths() {
  for (const path of SALES_PATHS) {
    revalidatePath(path);
  }
}

function formatLinkRpcError(rpcName: string, message: string): string {
  if (rpcName.includes("invoice")) {
    return formatSalesInvoiceRpcError(message).message;
  }
  if (rpcName.includes("quotation") || rpcName.includes("quote")) {
    return formatSalesQuoteRpcError(message).message;
  }
  return formatSalesOrderRpcError(message).message;
}

async function runLinkRpc(
  rpcName: string,
  args: Record<string, unknown>
): Promise<{ success: true } | { error: string }> {
  const { supabase } = await requireTenantId();
  const { error } = await supabase.rpc(rpcName, args);

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError(rpcName) };
    }
    return { error: formatLinkRpcError(rpcName, error.message) };
  }

  revalidateSalesPaths();
  return { success: true as const };
}

const linkOrderToQuotationSchema = z.object({
  sales_order_id: z.string().uuid(),
  quotation_id: z.string().uuid(),
});

export async function linkSalesOrderToQuotation(raw: unknown) {
  const parsed = linkOrderToQuotationSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid link request." };
  }

  return runLinkRpc("link_sales_order_to_quotation", {
    p_sales_order_id: parsed.data.sales_order_id,
    p_quotation_id: parsed.data.quotation_id,
  });
}

export async function linkSalesQuotationToOrder(raw: unknown) {
  const parsed = linkOrderToQuotationSchema
    .transform((value) => ({
      quotation_id: value.quotation_id,
      sales_order_id: value.sales_order_id,
    }))
    .safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid link request." };
  }

  return runLinkRpc("link_sales_quotation_to_order", {
    p_quotation_id: parsed.data.quotation_id,
    p_sales_order_id: parsed.data.sales_order_id,
  });
}

const linkInvoiceToQuotationSchema = z.object({
  sales_invoice_id: z.string().uuid(),
  quotation_id: z.string().uuid(),
});

export async function linkSalesInvoiceToQuotation(raw: unknown) {
  const parsed = linkInvoiceToQuotationSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid link request." };
  }

  return runLinkRpc("link_sales_invoice_to_quotation", {
    p_sales_invoice_id: parsed.data.sales_invoice_id,
    p_quotation_id: parsed.data.quotation_id,
  });
}

export async function linkSalesQuotationToInvoice(raw: unknown) {
  const parsed = linkInvoiceToQuotationSchema
    .transform((value) => ({
      quotation_id: value.quotation_id,
      sales_invoice_id: value.sales_invoice_id,
    }))
    .safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid link request." };
  }

  return runLinkRpc("link_sales_quotation_to_invoice", {
    p_quotation_id: parsed.data.quotation_id,
    p_sales_invoice_id: parsed.data.sales_invoice_id,
  });
}

const linkInvoiceToOrderSchema = z.object({
  sales_invoice_id: z.string().uuid(),
  sales_order_id: z.string().uuid(),
});

export async function linkSalesInvoiceToOrder(raw: unknown) {
  const parsed = linkInvoiceToOrderSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid link request." };
  }

  return runLinkRpc("link_sales_invoice_to_order", {
    p_sales_invoice_id: parsed.data.sales_invoice_id,
    p_sales_order_id: parsed.data.sales_order_id,
  });
}

const searchSchema = z.object({
  customer_id: z.string().uuid(),
  query: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export type LinkableDocumentOption = {
  id: string;
  number: string;
  status: string;
};

export async function searchLinkableQuotes(raw: unknown) {
  const parsed = searchSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid search." };
  }

  const { supabase, tenantId } = await requireTenantId();
  const limit = parsed.data.limit ?? 25;
  const query = parsed.data.query?.trim();

  let builder = supabase
    .from("sales_quotations")
    .select("id, quotation_number, commercial_status")
    .eq("tenant_id", tenantId)
    .eq("customer_id", parsed.data.customer_id)
    .is("converted_to_order_id", null)
    .is("converted_to_invoice_id", null)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (query) {
    builder = builder.ilike("quotation_number", `%${query}%`);
  }

  const { data, error } = await builder;
  if (error) return { error: "Unable to search quotations." };

  return {
    options: (data ?? []).map((row) => ({
      id: row.id as string,
      number: row.quotation_number as string,
      status: row.commercial_status as string,
    })),
  };
}

export async function searchLinkableSalesOrders(raw: unknown) {
  const parsed = searchSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid search." };
  }

  const { supabase, tenantId } = await requireTenantId();
  const limit = parsed.data.limit ?? 25;
  const query = parsed.data.query?.trim();

  let builder = supabase
    .from("sales_orders")
    .select("id, voucher_number, commercial_status")
    .eq("tenant_id", tenantId)
    .eq("customer_id", parsed.data.customer_id)
    .is("source_quotation_id", null)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (query) {
    builder = builder.ilike("voucher_number", `%${query}%`);
  }

  const { data, error } = await builder;
  if (error) return { error: "Unable to search sales orders." };

  return {
    options: (data ?? []).map((row) => ({
      id: row.id as string,
      number: row.voucher_number as string,
      status: row.commercial_status as string,
    })),
  };
}

export async function searchLinkableInvoices(raw: unknown) {
  const parsed = searchSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid search." };
  }

  const { supabase, tenantId } = await requireTenantId();
  const limit = parsed.data.limit ?? 25;
  const query = parsed.data.query?.trim();

  let builder = supabase
    .from("sales_invoices")
    .select("id, invoice_number, commercial_status")
    .eq("tenant_id", tenantId)
    .eq("customer_id", parsed.data.customer_id)
    .is("source_order_id", null)
    .is("source_quotation_id", null)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (query) {
    builder = builder.ilike("invoice_number", `%${query}%`);
  }

  const { data, error } = await builder;
  if (error) return { error: "Unable to search invoices." };

  return {
    options: (data ?? []).map((row) => ({
      id: row.id as string,
      number: row.invoice_number as string,
      status: row.commercial_status as string,
    })),
  };
}

export async function searchLinkableQuotesForOrderSlot(raw: unknown) {
  const parsed = searchSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid search." };
  }

  const { supabase, tenantId } = await requireTenantId();
  const limit = parsed.data.limit ?? 25;
  const query = parsed.data.query?.trim();

  let builder = supabase
    .from("sales_quotations")
    .select("id, quotation_number, commercial_status")
    .eq("tenant_id", tenantId)
    .eq("customer_id", parsed.data.customer_id)
    .is("converted_to_order_id", null)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (query) {
    builder = builder.ilike("quotation_number", `%${query}%`);
  }

  const { data, error } = await builder;
  if (error) return { error: "Unable to search quotations." };

  return {
    options: (data ?? []).map((row) => ({
      id: row.id as string,
      number: row.quotation_number as string,
      status: row.commercial_status as string,
    })),
  };
}

export async function searchLinkableQuotesForInvoiceSlot(raw: unknown) {
  const parsed = searchSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid search." };
  }

  const { supabase, tenantId } = await requireTenantId();
  const limit = parsed.data.limit ?? 25;
  const query = parsed.data.query?.trim();

  let builder = supabase
    .from("sales_quotations")
    .select("id, quotation_number, commercial_status")
    .eq("tenant_id", tenantId)
    .eq("customer_id", parsed.data.customer_id)
    .is("converted_to_invoice_id", null)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (query) {
    builder = builder.ilike("quotation_number", `%${query}%`);
  }

  const { data, error } = await builder;
  if (error) return { error: "Unable to search quotations." };

  return {
    options: (data ?? []).map((row) => ({
      id: row.id as string,
      number: row.quotation_number as string,
      status: row.commercial_status as string,
    })),
  };
}

export async function searchLinkableSalesOrdersForQuote(raw: unknown) {
  const parsed = searchSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid search." };
  }

  const { supabase, tenantId } = await requireTenantId();
  const limit = parsed.data.limit ?? 25;
  const query = parsed.data.query?.trim();

  let builder = supabase
    .from("sales_orders")
    .select("id, voucher_number, commercial_status")
    .eq("tenant_id", tenantId)
    .eq("customer_id", parsed.data.customer_id)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (query) {
    builder = builder.ilike("voucher_number", `%${query}%`);
  }

  const { data, error } = await builder;
  if (error) return { error: "Unable to search sales orders." };

  return {
    options: (data ?? []).map((row) => ({
      id: row.id as string,
      number: row.voucher_number as string,
      status: row.commercial_status as string,
    })),
  };
}

export async function loadInvoicesLinkedToSalesOrder(salesOrderId: string) {
  if (!salesOrderId) {
    return { error: "Sales order id is required." };
  }

  const { supabase, tenantId } = await requireTenantId();
  const invoices = await fetchInvoicesForSalesOrder(supabase, tenantId, salesOrderId);

  return {
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      href: `${SALES_INVOICES_HREF}?id=${encodeURIComponent(invoice.id)}`,
    })),
  };
}

export async function searchLinkableInvoicesForQuote(raw: unknown) {
  const parsed = searchSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid search." };
  }

  const { supabase, tenantId } = await requireTenantId();
  const limit = parsed.data.limit ?? 25;
  const query = parsed.data.query?.trim();

  let builder = supabase
    .from("sales_invoices")
    .select("id, invoice_number, commercial_status")
    .eq("tenant_id", tenantId)
    .eq("customer_id", parsed.data.customer_id)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (query) {
    builder = builder.ilike("invoice_number", `%${query}%`);
  }

  const { data, error } = await builder;
  if (error) return { error: "Unable to search invoices." };

  return {
    options: (data ?? []).map((row) => ({
      id: row.id as string,
      number: row.invoice_number as string,
      status: row.commercial_status as string,
    })),
  };
}
