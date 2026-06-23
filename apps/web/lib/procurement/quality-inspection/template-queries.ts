import type { SupabaseClient } from "@supabase/supabase-js";
import type { QcTestParameterDef, QcTestTemplate } from "@/lib/procurement/quality-inspection/types";

function formatDecimal(value: number | string | null | undefined, fallback = "0"): string {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return String(parsed);
}

function mapParameterRow(row: {
  id: string;
  name: string;
  parameter_type: string;
  min_value: number | string | null;
  max_value: number | string | null;
  expected_text: string | null;
  choice_options: unknown;
  is_mandatory: boolean;
  sort_order: number;
}): QcTestParameterDef {
  const choices = Array.isArray(row.choice_options)
    ? row.choice_options.filter((value): value is string => typeof value === "string")
    : [];

  return {
    id: row.id,
    name: row.name,
    parameter_type: row.parameter_type as QcTestParameterDef["parameter_type"],
    min_value: row.min_value != null ? formatDecimal(row.min_value) : null,
    max_value: row.max_value != null ? formatDecimal(row.max_value) : null,
    expected_text: row.expected_text,
    choice_options: choices,
    is_mandatory: row.is_mandatory,
    sort_order: row.sort_order,
  };
}

export type QcTestTemplateScope = QcTestTemplate["scope_type"];

export async function fetchQcTestTemplateByScope(
  supabase: SupabaseClient,
  tenantId: string,
  scopeType: QcTestTemplateScope,
  scopeReferenceId: string
): Promise<QcTestTemplate | null> {
  const { data: header, error } = await supabase
    .from("qc_test_templates")
    .select("id, name, description, scope_type, scope_reference_id")
    .eq("tenant_id", tenantId)
    .eq("scope_type", scopeType)
    .eq("scope_reference_id", scopeReferenceId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!header) return null;

  const { data: parameters, error: paramError } = await supabase
    .from("qc_test_parameters")
    .select(
      "id, name, parameter_type, min_value, max_value, expected_text, choice_options, is_mandatory, sort_order"
    )
    .eq("tenant_id", tenantId)
    .eq("template_id", header.id)
    .order("sort_order", { ascending: true });

  if (paramError) throw new Error(paramError.message);

  return {
    id: header.id,
    name: header.name,
    description: header.description,
    scope_type: header.scope_type as QcTestTemplateScope,
    scope_reference_id: header.scope_reference_id,
    parameters: (parameters ?? []).map(mapParameterRow),
  };
}

export type SaveQcTestTemplateInput = {
  name: string;
  description: string | null;
  parameters: Array<{
    name: string;
    parameter_type: QcTestParameterDef["parameter_type"];
    min_value: string | null;
    max_value: string | null;
    expected_text: string | null;
    choice_options: string[];
    is_mandatory: boolean;
    sort_order: number;
  }>;
};

export async function deleteQcTestTemplateByScope(
  supabase: SupabaseClient,
  tenantId: string,
  scopeType: QcTestTemplateScope,
  scopeReferenceId: string
): Promise<void> {
  const { error } = await supabase
    .from("qc_test_templates")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("scope_type", scopeType)
    .eq("scope_reference_id", scopeReferenceId);

  if (error) throw new Error(error.message);
}

export async function saveQcTestTemplateByScope(
  supabase: SupabaseClient,
  tenantId: string,
  scopeType: QcTestTemplateScope,
  scopeReferenceId: string,
  input: SaveQcTestTemplateInput
): Promise<QcTestTemplate> {
  const { data: header, error: headerError } = await supabase
    .from("qc_test_templates")
    .upsert(
      {
        tenant_id: tenantId,
        scope_type: scopeType,
        scope_reference_id: scopeReferenceId,
        name: input.name,
        description: input.description,
        is_active: true,
      },
      { onConflict: "tenant_id,scope_type,scope_reference_id" }
    )
    .select("id, name, description, scope_type, scope_reference_id")
    .single();

  if (headerError) throw new Error(headerError.message);

  const { error: deleteError } = await supabase
    .from("qc_test_parameters")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("template_id", header.id);

  if (deleteError) throw new Error(deleteError.message);

  if (input.parameters.length > 0) {
    const { error: insertError } = await supabase.from("qc_test_parameters").insert(
      input.parameters.map((parameter) => ({
        tenant_id: tenantId,
        template_id: header.id,
        name: parameter.name,
        parameter_type: parameter.parameter_type,
        min_value: parameter.min_value,
        max_value: parameter.max_value,
        expected_text: parameter.expected_text,
        choice_options: parameter.choice_options,
        is_mandatory: parameter.is_mandatory,
        sort_order: parameter.sort_order,
      }))
    );

    if (insertError) throw new Error(insertError.message);
  }

  const saved = await fetchQcTestTemplateByScope(supabase, tenantId, scopeType, scopeReferenceId);
  if (!saved) throw new Error("Template saved but could not be reloaded.");
  return saved;
}
