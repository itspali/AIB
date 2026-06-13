"use server";

import { revalidatePath } from "next/cache";
import { requireTenantId } from "@/lib/supabase/require-tenant";
import { defaultTaxCodesForCountry } from "@/lib/tax/presets";
import { taxCodeSchema } from "@/lib/tax/schemas";
import type { TaxCodeFormValues } from "@/lib/tax/types";

function toNumber(value: string, fallback = 0): number {
  const trimmed = value.trim();
  if (trimmed === "") return fallback;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function saveTaxCode(values: TaxCodeFormValues) {
  const parsed = taxCodeSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid tax code." };
  }

  const data = parsed.data;
  const { supabase } = await requireTenantId();

  const components = data.components
    .filter((component) => component.name.trim() !== "")
    .map((component, index) => ({
      name: component.name.trim(),
      rate: toNumber(component.rate),
      sort_order: component.sort_order ?? index,
    }));

  const rules = data.is_variable
    ? data.rules.map((rule) => ({
        basis: rule.basis,
        threshold_min: toNumber(rule.threshold_min),
        threshold_max: rule.threshold_max.trim() === "" ? null : toNumber(rule.threshold_max),
        rate: toNumber(rule.rate),
      }))
    : [];

  const { data: codeId, error } = await supabase.rpc("save_tax_code", {
    p_code: data.code.trim(),
    p_name: data.name.trim(),
    p_kind: data.kind,
    p_rate: toNumber(data.rate),
    p_is_inclusive: data.is_inclusive_default,
    p_is_variable: data.is_variable,
    p_effective_from: data.effective_from || null,
    p_effective_to: data.effective_to || null,
    p_is_active: data.is_active,
    p_components: components,
    p_rules: rules,
    p_tax_code_id: data.tax_code_id ?? null,
    p_is_recoverable: data.is_recoverable,
  });

  if (error) return { error: error.message };

  revalidatePath("/settings/tax");
  return { success: true as const, taxCodeId: codeId as string };
}

async function resolveTenantCountryCode(
  supabase: Awaited<ReturnType<typeof requireTenantId>>["supabase"],
  tenantId: string
): Promise<string> {
  const { data: location } = await supabase
    .from("tenant_locations")
    .select("country_code")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (location?.country_code) return String(location.country_code).toUpperCase();
  return "US";
}

export async function loadDefaultTaxCodes() {
  const { supabase, tenantId } = await requireTenantId();

  const countryCode = await resolveTenantCountryCode(supabase, tenantId);
  const presets = defaultTaxCodesForCountry(countryCode);

  const { data: existing } = await supabase
    .from("tax_codes")
    .select("code")
    .eq("tenant_id", tenantId);

  const existingCodes = new Set((existing ?? []).map((row) => String(row.code).toUpperCase()));

  let created = 0;
  for (const preset of presets) {
    if (existingCodes.has(preset.code.toUpperCase())) continue;

    const { error } = await supabase.rpc("save_tax_code", {
      p_code: preset.code,
      p_name: preset.name,
      p_kind: preset.kind,
      p_rate: preset.rate,
      p_is_inclusive: preset.is_inclusive_default,
      p_is_variable: preset.is_variable,
      p_effective_from: null,
      p_effective_to: null,
      p_is_active: true,
      p_components: preset.components,
      p_rules: preset.rules,
      p_tax_code_id: null,
    });

    if (error) return { error: error.message };
    created += 1;
  }

  revalidatePath("/settings/tax");
  return { success: true as const, created, countryCode };
}

export async function deleteTaxCode(taxCodeId: string) {
  if (!taxCodeId) return { error: "Tax code id is required." };

  const { supabase } = await requireTenantId();

  const { data, error } = await supabase.rpc("delete_tax_code", {
    p_tax_code_id: taxCodeId,
  });

  if (error) return { error: error.message };

  revalidatePath("/settings/tax");
  return { success: true as const, outcome: (data as string) ?? "DELETED" };
}
