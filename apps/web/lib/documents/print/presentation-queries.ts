import type { SupabaseClient } from "@supabase/supabase-js";
import {
  presentationTemplateFromRow,
  serializePresentationTemplate,
  type DocumentPresentationSystemDefaultRow,
  type DocumentPresentationTemplateRow,
} from "@/lib/documents/print/presentation-persistence";
import type { DocumentPresentationTemplate, PresentationViewContext } from "@/lib/documents/print/types";
import type { DocumentModuleKey } from "@/lib/documents/types";

type FetchPresentationOptions = {
  locationId?: string | null;
};

async function fetchPresentationRow(
  supabase: SupabaseClient,
  tenantId: string,
  moduleKey: DocumentModuleKey,
  viewContext: PresentationViewContext,
  options?: FetchPresentationOptions
): Promise<DocumentPresentationTemplateRow | null> {
  const locationId = options?.locationId?.trim() || null;

  let query = supabase
    .from("document_presentation_templates")
    .select(
      "template_key, module_key, view_context, label, description, shell_config, style_config, is_default, is_active, is_customized"
    )
    .eq("tenant_id", tenantId)
    .eq("module_key", moduleKey)
    .eq("view_context", viewContext)
    .eq("is_active", true);

  query = locationId ? query.eq("location_id", locationId) : query.is("location_id", null);

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return (data as DocumentPresentationTemplateRow | null) ?? null;
}

async function fetchSystemDefaultRow(
  supabase: SupabaseClient,
  moduleKey: DocumentModuleKey,
  viewContext: PresentationViewContext
): Promise<DocumentPresentationSystemDefaultRow | null> {
  const { data, error } = await supabase
    .from("document_presentation_system_defaults")
    .select("template_key, module_key, view_context, label, description, shell_config, style_config")
    .eq("module_key", moduleKey)
    .eq("view_context", viewContext)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as DocumentPresentationSystemDefaultRow | null) ?? null;
}

export async function fetchDocumentPresentationTemplate(
  supabase: SupabaseClient,
  tenantId: string,
  moduleKey: DocumentModuleKey,
  viewContext: PresentationViewContext,
  options?: FetchPresentationOptions
): Promise<DocumentPresentationTemplate> {
  const row = await fetchPresentationRow(supabase, tenantId, moduleKey, viewContext, options);
  if (row) return presentationTemplateFromRow(row, moduleKey, viewContext);

  const systemDefault = await fetchSystemDefaultRow(supabase, moduleKey, viewContext);
  return presentationTemplateFromRow(systemDefault, moduleKey, viewContext);
}

export async function fetchDocumentPresentationTemplateIfExists(
  supabase: SupabaseClient,
  tenantId: string,
  moduleKey: DocumentModuleKey,
  viewContext: PresentationViewContext,
  options: FetchPresentationOptions & { locationId: string }
): Promise<DocumentPresentationTemplate | null> {
  const row = await fetchPresentationRow(supabase, tenantId, moduleKey, viewContext, options);
  if (!row) return null;
  return presentationTemplateFromRow(row, moduleKey, viewContext);
}

export async function upsertDocumentPresentationTemplate(
  supabase: SupabaseClient,
  tenantId: string,
  template: DocumentPresentationTemplate,
  options?: FetchPresentationOptions
): Promise<void> {
  const payload = serializePresentationTemplate(template);
  const locationId = options?.locationId?.trim() || null;

  let existingQuery = supabase
    .from("document_presentation_templates")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("module_key", template.moduleKey)
    .eq("view_context", template.viewContext);

  existingQuery = locationId
    ? existingQuery.eq("location_id", locationId)
    : existingQuery.is("location_id", null);

  const { data: existing, error: existingError } = await existingQuery.maybeSingle();
  if (existingError) throw new Error(existingError.message);

  const updatePayload = {
    template_key: payload.template_key,
    label: payload.label,
    description: payload.description,
    shell_config: payload.shell_config,
    style_config: payload.style_config,
    is_customized: true,
    is_active: template.isActive,
    is_default: template.isDefault,
  };

  if (existing?.id) {
    const { error } = await supabase
      .from("document_presentation_templates")
      .update(updatePayload)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from("document_presentation_templates").insert({
    tenant_id: tenantId,
    location_id: locationId,
    ...payload,
    is_customized: true,
    is_active: template.isActive,
    is_default: template.isDefault,
  });

  if (error) throw new Error(error.message);
}

export async function ensureTenantPresentationTemplates(
  supabase: SupabaseClient
): Promise<{ ensured: boolean; error?: string }> {
  const { error } = await supabase.rpc("ensure_tenant_presentation_templates");

  if (error) {
    const { isMissingRpcError, formatRpcDeployError } = await import("@/lib/supabase/rpc-error");
    if (isMissingRpcError(error)) {
      return { ensured: false, error: formatRpcDeployError("ensure_tenant_presentation_templates") };
    }
    return { ensured: false, error: error.message };
  }

  return { ensured: true };
}

export async function fetchPresentationTemplatesForModule(
  supabase: SupabaseClient,
  tenantId: string,
  moduleKey: DocumentModuleKey
): Promise<DocumentPresentationTemplate[]> {
  const contexts: PresentationViewContext[] = ["PDF_PRINT", "EMAIL_HTML"];
  return Promise.all(
    contexts.map((viewContext) =>
      fetchDocumentPresentationTemplate(supabase, tenantId, moduleKey, viewContext)
    )
  );
}
