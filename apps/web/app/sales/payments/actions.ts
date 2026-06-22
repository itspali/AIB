"use server";

import { revalidatePath } from "next/cache";
import {
  fetchCustomerPaymentById,
  fetchCustomerPayments,
} from "@/lib/sales/payments/queries";
import {
  applyCustomerPaymentSchema,
  saveCustomerPaymentSchema,
} from "@/lib/sales/payments/schemas";
import type { CustomerPaymentRow } from "@/lib/sales/payments/types";
import {
  fetchOpenSalesInvoicesForCustomer,
} from "@/lib/sales/invoices/queries";
import type { OpenSalesInvoiceOption } from "@/lib/sales/invoices/types";
import { SALES_INVOICES_HREF, SALES_PAYMENTS_HREF } from "@/lib/sales/navigation";
import { formatRpcDeployError, isMissingRpcError } from "@/lib/supabase/rpc-error";
import { requireTenantMutation } from "@/lib/supabase/require-tenant";
import { z } from "zod";

const PAYMENT_PATHS = [SALES_PAYMENTS_HREF, SALES_INVOICES_HREF, "/sales", "/dashboard"] as const;

function revalidatePaymentPaths() {
  for (const path of PAYMENT_PATHS) {
    revalidatePath(path);
  }
}

export async function loadCustomerPayments(): Promise<CustomerPaymentRow[]> {
  const { supabase, tenantId } = await requireTenantMutation();
  return fetchCustomerPayments(supabase, tenantId);
}

export async function loadCustomerPaymentDetail(
  paymentId: string
): Promise<{ payment: CustomerPaymentRow } | { error: string }> {
  const parsed = z.string().uuid().safeParse(paymentId);
  if (!parsed.success) return { error: "Invalid payment id." };

  const { supabase, tenantId } = await requireTenantMutation();
  try {
    const payment = await fetchCustomerPaymentById(supabase, tenantId, parsed.data);
    if (!payment) return { error: "Payment not found." };
    return { payment };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to load payment detail.",
    };
  }
}

export async function loadOpenInvoicesForCustomer(
  customerId: string
): Promise<{ invoices: OpenSalesInvoiceOption[] } | { error: string }> {
  const parsed = z.string().uuid().safeParse(customerId);
  if (!parsed.success) return { error: "Invalid customer id." };

  const { supabase, tenantId } = await requireTenantMutation();
  try {
    const invoices = await fetchOpenSalesInvoicesForCustomer(supabase, tenantId, parsed.data);
    return { invoices };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to load open invoices.",
    };
  }
}

export async function saveCustomerPayment(raw: unknown) {
  const parsed = saveCustomerPaymentSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid payment." };
  }

  const { supabase, userId } = await requireTenantMutation();
  const { data, error } = await supabase.rpc("save_customer_payment", {
    p_customer_id: parsed.data.customer_id,
    p_amount_received: parsed.data.amount_received,
    p_payment_method: parsed.data.payment_method,
    p_created_by: userId,
    p_reference_number: parsed.data.reference_number ?? null,
    p_currency_code: parsed.data.currency_code ?? null,
    p_exchange_rate: parsed.data.exchange_rate ?? null,
    p_received_at: parsed.data.received_at || null,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("save_customer_payment") };
    }
    return { error: error.message };
  }

  revalidatePaymentPaths();
  return { success: true as const, paymentId: data as string };
}

export async function applyCustomerPaymentToInvoice(raw: unknown) {
  const parsed = applyCustomerPaymentSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid payment application." };
  }

  const { supabase } = await requireTenantMutation();
  const { data, error } = await supabase.rpc("apply_customer_payment_to_invoice", {
    p_payment_id: parsed.data.payment_id,
    p_invoice_id: parsed.data.invoice_id,
    p_amount: parsed.data.amount,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("apply_customer_payment_to_invoice") };
    }
    return { error: error.message };
  }

  revalidatePaymentPaths();
  return { success: true as const, applicationId: data as string };
}
