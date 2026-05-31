"use server";

import { revalidatePath } from "next/cache";
import { requireTenantId } from "@/lib/supabase/require-tenant";
import type { TaxRateSlabInput } from "@/lib/dashboard/types";

function toTaxCodeSlug(value: string): string {
  const slug = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 18);
  return slug || "TAX";
}

export async function addTaxRateSlab(input: TaxRateSlabInput) {
  const name = input.tax_component_name?.trim();
  if (!name) return { error: "Component name is required" };

  const { supabase, tenantId } = await requireTenantId();

  const pct = Number.parseFloat(input.tax_percentage) || 0;

  const { error } = await supabase.from("tax_codes").insert({
    tenant_id: tenantId,
    code: `${toTaxCodeSlug(name)}-${crypto.randomUUID().slice(0, 6)}`,
    name,
    kind: pct === 0 ? "ZERO" : "GST",
    rate: pct,
    is_inclusive_default: false,
    is_variable: false,
    effective_from: input.active_from_date
      ? new Date(input.active_from_date).toISOString().slice(0, 10)
      : null,
    effective_to: input.active_to_date
      ? new Date(input.active_to_date).toISOString().slice(0, 10)
      : null,
    is_active: true,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { success: true as const };
}

export async function dismissGettingStarted() {
  const { supabase, tenantId } = await requireTenantId();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("metadata_json")
    .eq("id", tenantId)
    .single();

  const metadata = (tenant?.metadata_json as Record<string, unknown> | null) ?? {};

  const { error } = await supabase
    .from("tenants")
    .update({
      metadata_json: {
        ...metadata,
        getting_started_dismissed: true,
        getting_started_dismissed_at: new Date().toISOString(),
      },
    })
    .eq("id", tenantId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { success: true as const };
}

export async function markOrgSettingsReviewed() {
  const { supabase, tenantId } = await requireTenantId();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("metadata_json")
    .eq("id", tenantId)
    .single();

  const metadata = (tenant?.metadata_json as Record<string, unknown> | null) ?? {};

  const { error } = await supabase
    .from("tenants")
    .update({
      metadata_json: {
        ...metadata,
        getting_started_org_reviewed: true,
      },
    })
    .eq("id", tenantId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/settings/organization");
  return { success: true as const };
}
