import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDate } from "@/lib/dashboard/format";
import { buildDocumentPrintModel } from "@/lib/documents/build-document-print-model";
import { fetchDocumentOrgRenderContext } from "@/lib/documents/print/org-render-context";
import { resolveEffectivePresentationTemplate } from "@/lib/documents/print/resolve-effective-presentation";
import { renderDocumentHtml } from "@/lib/documents/print/render-document-html";
import { resolveEffectiveDocumentLayout } from "@/lib/documents/resolve-effective-document-layout";
import { generatePdfFromHtml } from "@/lib/email/generate-document-pdf";
import {
  isTransactionalEmailConfigured,
  sendTransactionalEmail,
} from "@/lib/email/send-transactional-email";
import { renderNotificationTemplate } from "@/lib/notifications/render-template";
import { fetchSalesQuotationById } from "@/lib/sales/quotes/queries";
import type { SalesQuoteRow } from "@/lib/sales/quotes/types";

export type SendQuotationEmailResult =
  | { success: true; emailSent: boolean; sentToEmail: string | null }
  | { success: false; error: string; notConfigured?: boolean };

async function loadQuotationEmailTemplate(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{
  subject_template: string | null;
  body_template: string;
  body_template_html: string | null;
} | null> {
  const { data } = await supabase
    .from("notification_templates")
    .select("subject_template, body_template, body_template_html, is_active")
    .eq("tenant_id", tenantId)
    .eq("template_key", "sales.quotation.sent")
    .eq("channel", "EMAIL")
    .eq("locale", "en-US")
    .maybeSingle();

  if (!data || !data.is_active) return null;

  return {
    subject_template: (data.subject_template as string | null) ?? null,
    body_template: data.body_template as string,
    body_template_html: (data.body_template_html as string | null) ?? null,
  };
}

function formatAmount(amount: string, currency = "INR"): string {
  const parsed = Number(amount);
  if (!Number.isFinite(parsed)) return amount;
  return `${currency} ${parsed.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function sendQuotationEmailForQuote(input: {
  supabase: SupabaseClient;
  tenantId: string;
  quotationId: string;
  sentToEmail: string;
  senderName: string;
}): Promise<SendQuotationEmailResult> {
  const quote = await fetchSalesQuotationById(input.supabase, input.tenantId, input.quotationId);
  if (!quote) {
    return { success: false, error: "Quote not found." };
  }

  const template = await loadQuotationEmailTemplate(input.supabase, input.tenantId);
  const [layout, presentation] = await Promise.all([
    resolveEffectiveDocumentLayout({
      supabase: input.supabase,
      tenantId: input.tenantId,
      moduleKey: "SALES_QUOTATION",
      viewContext: "EMAIL_HTML",
      documentLocationId: quote.origin_location_id,
    }),
    resolveEffectivePresentationTemplate({
      supabase: input.supabase,
      tenantId: input.tenantId,
      moduleKey: "SALES_QUOTATION",
      viewContext: "EMAIL_HTML",
      documentLocationId: quote.origin_location_id,
    }),
  ]);

  const printModel = buildDocumentPrintModel("SALES_QUOTATION", layout, quote);
  const org = await fetchDocumentOrgRenderContext(input.supabase, input.tenantId, {
    locationId: quote.origin_location_id,
  });
  const printHtml = renderDocumentHtml(quote.quotation_number, printModel, presentation, org);

  const context: Record<string, string> = {
    quotation_number: quote.quotation_number,
    customer_name: quote.customer_name,
    valid_until: formatDate(quote.valid_until),
    total_net_amount: formatAmount(quote.total_net_amount),
    sender_name: input.senderName,
  };

  const subject = template?.subject_template
    ? renderNotificationTemplate(template.subject_template, context)
    : `Quotation ${quote.quotation_number}`;

  const html = template?.body_template_html
    ? renderNotificationTemplate(template.body_template_html, context)
    : renderNotificationTemplate(
        template?.body_template ??
          "Please find attached our quotation {{quotation_number}}. Valid until {{valid_until}}. Total: {{total_net_amount}}.",
        context
      );

  const text = template?.body_template
    ? renderNotificationTemplate(template.body_template, context)
    : `Quotation ${quote.quotation_number}`;

  if (!isTransactionalEmailConfigured()) {
    return {
      success: false,
      error: "Email is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL, or mark as sent manually.",
      notConfigured: true,
    };
  }

  const pdfBuffer = await generatePdfFromHtml(printHtml);
  const attachments = pdfBuffer
    ? [{ filename: `${quote.quotation_number}.pdf`, content: pdfBuffer }]
    : undefined;

  const emailResult = await sendTransactionalEmail({
    to: input.sentToEmail,
    subject,
    html,
    text,
    attachments,
  });

  if (!emailResult.success) {
    return {
      success: false,
      error: emailResult.error,
      notConfigured: emailResult.notConfigured,
    };
  }

  return { success: true, emailSent: true, sentToEmail: input.sentToEmail };
}

export async function resolveCustomerEmailForQuote(
  supabase: SupabaseClient,
  tenantId: string,
  customerId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("entities")
    .select("primary_contact_email, company_email")
    .eq("tenant_id", tenantId)
    .eq("id", customerId)
    .maybeSingle();

  if (!data) return null;
  const primary = (data.primary_contact_email as string | null)?.trim();
  const company = (data.company_email as string | null)?.trim();
  return primary || company || null;
}
