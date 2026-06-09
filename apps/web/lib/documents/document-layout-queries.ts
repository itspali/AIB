import type { SupabaseClient } from "@supabase/supabase-js";
import {
  documentLayoutFromRow,
  serializeDocumentLayoutTemplate,
  type DocumentLayoutTemplateRow,
} from "@/lib/documents/document-layout-persistence";
import type { DocumentLayoutTemplate, DocumentModuleKey, DocumentViewContext } from "@/lib/documents/types";

export async function fetchDocumentLayoutTemplate(
  supabase: SupabaseClient,
  tenantId: string,
  moduleKey: DocumentModuleKey,
  viewContext: DocumentViewContext
): Promise<DocumentLayoutTemplate> {
  const { data, error } = await supabase
    .from("document_layout_templates")
    .select("module_key, view_context, image_display_mode, grid_columns_json, line_item_formatting")
    .eq("tenant_id", tenantId)
    .eq("module_key", moduleKey)
    .eq("view_context", viewContext)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return documentLayoutFromRow(
    data as DocumentLayoutTemplateRow | null,
    moduleKey,
    viewContext
  );
}

export async function upsertDocumentLayoutTemplate(
  supabase: SupabaseClient,
  tenantId: string,
  layout: DocumentLayoutTemplate
): Promise<void> {
  const payload = serializeDocumentLayoutTemplate(layout);
  const { error } = await supabase.from("document_layout_templates").upsert(
    {
      tenant_id: tenantId,
      ...payload,
    },
    { onConflict: "tenant_id,module_key,view_context" }
  );

  if (error) throw new Error(error.message);
}
