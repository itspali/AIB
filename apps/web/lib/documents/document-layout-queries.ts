import type { SupabaseClient } from "@supabase/supabase-js";
import {
  documentLayoutFromRow,
  serializeDocumentLayoutTemplate,
  type DocumentLayoutTemplateRow,
} from "@/lib/documents/document-layout-persistence";
import type { DocumentLayoutTemplate, DocumentModuleKey, DocumentViewContext } from "@/lib/documents/types";

type FetchLayoutOptions = {
  locationId?: string | null;
};

async function fetchDocumentLayoutRow(
  supabase: SupabaseClient,
  tenantId: string,
  moduleKey: DocumentModuleKey,
  viewContext: DocumentViewContext,
  options?: FetchLayoutOptions
): Promise<DocumentLayoutTemplateRow | null> {
  const locationId = options?.locationId?.trim() || null;

  let query = supabase
    .from("document_layout_templates")
    .select("module_key, view_context, image_display_mode, grid_columns_json, line_item_formatting")
    .eq("tenant_id", tenantId)
    .eq("module_key", moduleKey)
    .eq("view_context", viewContext);

  query = locationId
    ? query.eq("location_id", locationId)
    : query.is("location_id", null);

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return (data as DocumentLayoutTemplateRow | null) ?? null;
}

export async function fetchDocumentLayoutTemplate(
  supabase: SupabaseClient,
  tenantId: string,
  moduleKey: DocumentModuleKey,
  viewContext: DocumentViewContext,
  options?: FetchLayoutOptions
): Promise<DocumentLayoutTemplate> {
  const row = await fetchDocumentLayoutRow(
    supabase,
    tenantId,
    moduleKey,
    viewContext,
    options
  );

  return documentLayoutFromRow(row, moduleKey, viewContext);
}

export async function fetchDocumentLayoutTemplateIfExists(
  supabase: SupabaseClient,
  tenantId: string,
  moduleKey: DocumentModuleKey,
  viewContext: DocumentViewContext,
  options: FetchLayoutOptions & { locationId: string }
): Promise<DocumentLayoutTemplate | null> {
  const row = await fetchDocumentLayoutRow(
    supabase,
    tenantId,
    moduleKey,
    viewContext,
    options
  );
  if (!row) return null;
  return documentLayoutFromRow(row, moduleKey, viewContext);
}

export async function upsertDocumentLayoutTemplate(
  supabase: SupabaseClient,
  tenantId: string,
  layout: DocumentLayoutTemplate,
  options?: FetchLayoutOptions
): Promise<void> {
  const payload = serializeDocumentLayoutTemplate(layout);
  const locationId = options?.locationId?.trim() || null;

  let existingQuery = supabase
    .from("document_layout_templates")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("module_key", layout.moduleKey)
    .eq("view_context", layout.viewContext);

  existingQuery = locationId
    ? existingQuery.eq("location_id", locationId)
    : existingQuery.is("location_id", null);

  const { data: existing, error: existingError } = await existingQuery.maybeSingle();

  if (existingError) throw new Error(existingError.message);

  if (existing?.id) {
    const { error } = await supabase
      .from("document_layout_templates")
      .update({
        image_display_mode: payload.image_display_mode,
        grid_columns_json: payload.grid_columns_json,
        line_item_formatting: payload.line_item_formatting,
      })
      .eq("id", existing.id);

    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from("document_layout_templates").insert({
    tenant_id: tenantId,
    location_id: locationId,
    ...payload,
  });

  if (error) throw new Error(error.message);
}
