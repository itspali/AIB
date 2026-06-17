"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  fetchDocumentPresentationTemplate,
  upsertDocumentPresentationTemplate,
} from "@/lib/documents/print/presentation-queries";
import {
  normalizePresentationShellConfig,
  normalizePresentationStyleConfig,
} from "@/lib/documents/print/default-shell-config";
import { presentationTemplateFromRow } from "@/lib/documents/print/presentation-persistence";
import type { DocumentPresentationTemplate, PresentationViewContext } from "@/lib/documents/print/types";
import type { DocumentModuleKey } from "@/lib/documents/types";
import { fetchDocumentOrgRenderContext } from "@/lib/documents/print/org-render-context";
import { renderDocumentHtml } from "@/lib/documents/print/render-document-html";
import type { DocumentPrintModel } from "@/lib/documents/build-document-print-model";
import { resolveOrganizationSettingsAccess } from "@/lib/organization/access";
import { requireTenantId } from "@/lib/supabase/require-tenant";

const moduleKeySchema = z.enum([
  "PURCHASE_ORDER",
  "GOODS_RECEIPT_NOTE",
  "PURCHASE_INVOICE",
  "SALES_QUOTATION",
  "SALES_ORDER",
  "SALES_INVOICE",
]);

const viewContextSchema = z.enum(["PDF_PRINT", "EMAIL_HTML"]);

const shellConfigSchema = z.object({
  version: z.literal(1),
  page: z.object({
    size: z.enum(["A4", "LETTER"]),
    orientation: z.enum(["portrait", "landscape"]),
  }),
  margins: z.object({
    top: z.string(),
    bottom: z.string(),
    left: z.string(),
    right: z.string(),
  }),
  header: z.object({
    showLogo: z.boolean(),
    showOrgName: z.boolean(),
    showOrgAddress: z.boolean(),
    showDocumentTitle: z.boolean(),
    titleOverride: z.string().nullable(),
  }),
  footer: z.object({
    showPageNumbers: z.boolean(),
    legalText: z.string(),
  }),
  sections: z.object({
    showHeaderFields: z.boolean(),
    showLineTable: z.boolean(),
    showTotals: z.boolean(),
    showTerms: z.boolean(),
    termsText: z.string(),
  }),
});

const saveSchema = z.object({
  moduleKey: moduleKeySchema,
  viewContext: viewContextSchema,
  shellConfig: shellConfigSchema,
});

async function requireTemplateEditor(): Promise<
  | { supabase: Awaited<ReturnType<typeof requireTenantId>>["supabase"]; tenantId: string; userId: string }
  | { error: string }
> {
  const { supabase, tenantId, userId } = await requireTenantId();
  const access = await resolveOrganizationSettingsAccess(supabase, userId, tenantId);
  if (!access.granted) {
    return { error: "You do not have permission to edit document templates." };
  }
  return { supabase, tenantId, userId };
}

function revalidateTemplatePaths(moduleKey: DocumentModuleKey) {
  revalidatePath("/settings/documents/templates");
  revalidatePath(`/settings/documents/templates/${moduleKey}`);
}

function samplePrintModel(moduleKey: DocumentModuleKey): DocumentPrintModel {
  return {
    moduleKey,
    headerFields: [
      { id: "supplier", label: "Supplier", value: "Acme Supplies Pvt Ltd" },
      { id: "voucher_number", label: "Document no.", value: "DOC-00001" },
      { id: "created_at", label: "Date", value: "17 Jun 2026" },
    ],
    lineColumns: [
      { id: "item", label: "Item", defaultVisible: true },
      { id: "quantity_ordered", label: "Qty", defaultVisible: true, align: "right" },
      { id: "unit_price", label: "Rate", defaultVisible: true, align: "right" },
      { id: "line_total", label: "Amount", defaultVisible: true, align: "right" },
    ],
    lines: [
      {
        item: "Widget A",
        quantity_ordered: "2",
        unit_price: "500.00",
        line_total: "1,000.00",
      },
      {
        item: "Widget B",
        quantity_ordered: "1",
        unit_price: "250.00",
        line_total: "250.00",
      },
    ],
    totalsFields: [
      { id: "subtotal_ex_tax", label: "Subtotal", value: "1,250.00" },
      { id: "tax_amount", label: "Tax", value: "225.00" },
      { id: "grand_total", label: "Grand total", value: "1,475.00" },
    ],
  };
}

export async function loadPresentationTemplate(input: {
  moduleKey: DocumentModuleKey;
  viewContext: PresentationViewContext;
}): Promise<{ template: DocumentPresentationTemplate } | { error: string }> {
  const parsedModule = moduleKeySchema.safeParse(input.moduleKey);
  const parsedView = viewContextSchema.safeParse(input.viewContext);
  if (!parsedModule.success || !parsedView.success) {
    return { error: "Invalid template request." };
  }

  try {
    const { supabase, tenantId } = await requireTenantId();
    const template = await fetchDocumentPresentationTemplate(
      supabase,
      tenantId,
      parsedModule.data,
      parsedView.data
    );
    return { template };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to load template." };
  }
}

export async function savePresentationTemplate(
  input: z.infer<typeof saveSchema>
): Promise<{ success: true } | { error: string }> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid presentation template payload." };
  }

  const editor = await requireTemplateEditor();
  if ("error" in editor) return editor;

  const existing = await fetchDocumentPresentationTemplate(
    editor.supabase,
    editor.tenantId,
    parsed.data.moduleKey,
    parsed.data.viewContext
  );

  const nextTemplate: DocumentPresentationTemplate = {
    ...existing,
    shellConfig: normalizePresentationShellConfig(parsed.data.shellConfig),
    styleConfig: existing.styleConfig,
    isCustomized: true,
  };

  try {
    await upsertDocumentPresentationTemplate(editor.supabase, editor.tenantId, nextTemplate);
    revalidateTemplatePaths(parsed.data.moduleKey);
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to save template." };
  }
}

export async function resetPresentationTemplate(input: {
  moduleKey: DocumentModuleKey;
  viewContext: PresentationViewContext;
}): Promise<{ success: true; template: DocumentPresentationTemplate } | { error: string }> {
  const parsedModule = moduleKeySchema.safeParse(input.moduleKey);
  const parsedView = viewContextSchema.safeParse(input.viewContext);
  if (!parsedModule.success || !parsedView.success) {
    return { error: "Invalid template request." };
  }

  const editor = await requireTemplateEditor();
  if ("error" in editor) return editor;

  const { data: systemDefault, error: systemError } = await editor.supabase
    .from("document_presentation_system_defaults")
    .select("template_key, module_key, view_context, label, description, shell_config, style_config")
    .eq("module_key", parsedModule.data)
    .eq("view_context", parsedView.data)
    .maybeSingle();

  if (systemError) return { error: systemError.message };
  if (!systemDefault) return { error: "System default template not found." };

  const template = presentationTemplateFromRow(systemDefault, parsedModule.data, parsedView.data);

  try {
    await upsertDocumentPresentationTemplate(editor.supabase, editor.tenantId, {
      ...template,
      isCustomized: false,
    });
    revalidateTemplatePaths(parsedModule.data);
    return { success: true, template };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to reset template." };
  }
}

export async function loadPresentationTemplatePreview(input: {
  moduleKey: DocumentModuleKey;
  viewContext: PresentationViewContext;
  shellConfig: z.infer<typeof shellConfigSchema>;
}): Promise<{ html: string } | { error: string }> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid preview request." };
  }

  try {
    const { supabase, tenantId } = await requireTenantId();
    const [existing, org] = await Promise.all([
      fetchDocumentPresentationTemplate(supabase, tenantId, parsed.data.moduleKey, parsed.data.viewContext),
      fetchDocumentOrgRenderContext(supabase, tenantId),
    ]);

    const presentation: DocumentPresentationTemplate = {
      ...existing,
      shellConfig: normalizePresentationShellConfig(parsed.data.shellConfig),
      styleConfig: normalizePresentationStyleConfig(existing.styleConfig),
    };

    const html = renderDocumentHtml(
      "DOC-00001",
      samplePrintModel(parsed.data.moduleKey),
      presentation,
      org
    );

    return { html };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to render preview." };
  }
}
