"use server";

import { revalidatePath } from "next/cache";
import { locationFormSchema, domRoutingSaveSchema } from "@/lib/locations/schemas";
import type { LocationCodeSuggestInput, LocationCodeSuggestion } from "@/lib/locations/code-generation";
import { resolveLocationManagementAccess } from "@/lib/locations/access";
import { buildDomRoutingPatch } from "@/lib/locations/dom-routing";
import { formatRpcDeployError, isMissingRpcError } from "@/lib/supabase/rpc-error";
import { requireTenantId } from "@/lib/supabase/require-tenant";

const LOCATION_PATHS = [
  "/inventory/locations",
  "/inventory/locations/topology",
  "/settings/organization",
  "/dashboard",
];

export async function saveLocation(raw: unknown) {
  const parsed = locationFormSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid location data" };
  }

  const values = parsed.data;
  const { supabase, tenantId } = await requireTenantId();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const access = await resolveLocationManagementAccess(supabase, user.id, tenantId);
  if (!access.canManage) {
    return { error: "Administrative privileges required." };
  }

  const locationMeta =
    !values.location_id && values.code_generation
      ? {
          code_generation: {
            ...values.code_generation,
            manually_edited: values.code_manually_edited ?? false,
            generated_at: new Date().toISOString(),
          },
        }
      : null;

  const { data, error } = await supabase.rpc("save_tenant_location", {
    p_location_id: values.location_id,
    p_name: values.name,
    p_code: values.code,
    p_presence_type: values.presence_type,
    p_parent_location_id: values.parent_location_id,
    p_address_line1: values.address_line1,
    p_address_line2: values.address_line2 || null,
    p_city: values.city,
    p_state: values.state,
    p_zip_postal: values.zip_postal,
    p_country_code: values.country_code,
    p_manager_name: values.manager_name || null,
    p_contact_email: values.contact_email || null,
    p_contact_phone: values.contact_phone || null,
    p_is_administrative_office: values.is_administrative_office,
    p_is_commercial_storefront: values.is_commercial_storefront,
    p_is_manufacturing_floor: values.is_manufacturing_floor,
    p_is_stock_holding: values.is_stock_holding,
    p_pos_terminal_count: values.pos_terminal_count,
    p_location_tax_identifier: values.location_tax_identifier || null,
    p_tax_registered_name: values.tax_registered_name || null,
    p_location_meta: locationMeta,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("save_tenant_location") };
    }
    return { error: error.message };
  }

  for (const path of LOCATION_PATHS) {
    revalidatePath(path);
  }

  return { success: true as const, locationId: data as string };
}

export async function suggestLocationCode(input: LocationCodeSuggestInput) {
  const { supabase, tenantId } = await requireTenantId();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const access = await resolveLocationManagementAccess(supabase, user.id, tenantId);
  if (!access.canManage) {
    return { error: "Administrative privileges required." };
  }

  const { data, error } = await supabase.rpc("suggest_tenant_location_code", {
    p_presence_type: input.presence_type,
    p_is_administrative_office: input.is_administrative_office,
    p_is_commercial_storefront: input.is_commercial_storefront,
    p_is_manufacturing_floor: input.is_manufacturing_floor,
    p_is_stock_holding: input.is_stock_holding,
    p_parent_location_id: input.parent_location_id,
    p_country_code: input.country_code,
    p_city: input.city || null,
    p_location_id: input.location_id,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("suggest_tenant_location_code") };
    }
    return { error: error.message };
  }

  const suggestion = data as Record<string, unknown>;
  return {
    success: true as const,
    suggestion: {
      code: String(suggestion.code),
      scope: String(suggestion.scope),
      role: String(suggestion.role),
      sequence: Number(suggestion.sequence),
      role_key: String(suggestion.role_key),
    } satisfies LocationCodeSuggestion,
  };
}

export async function deactivateLocation(locationId: string) {
  const { supabase, tenantId } = await requireTenantId();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const access = await resolveLocationManagementAccess(supabase, user.id, tenantId);
  if (!access.canManage) {
    return { error: "Administrative privileges required." };
  }

  const { error } = await supabase.rpc("deactivate_tenant_location", {
    p_location_id: locationId,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("deactivate_tenant_location") };
    }
    return { error: error.message };
  }

  for (const path of LOCATION_PATHS) {
    revalidatePath(path);
  }

  return { success: true as const };
}

export async function reactivateLocation(locationId: string) {
  const { supabase, tenantId } = await requireTenantId();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const access = await resolveLocationManagementAccess(supabase, user.id, tenantId);
  if (!access.canManage) {
    return { error: "Administrative privileges required." };
  }

  const { error } = await supabase.rpc("reactivate_tenant_location", {
    p_location_id: locationId,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("reactivate_tenant_location") };
    }
    return { error: error.message };
  }

  for (const path of LOCATION_PATHS) {
    revalidatePath(path);
  }

  return { success: true as const };
}

export async function saveDomRoutingConfig(raw: unknown) {
  const parsed = domRoutingSaveSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid DOM routing configuration" };
  }

  const { supabase, tenantId } = await requireTenantId();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const access = await resolveLocationManagementAccess(supabase, user.id, tenantId);
  if (!access.canManage) {
    return { error: "Administrative privileges required." };
  }

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("legal_name, primary_email, primary_phone")
    .eq("id", tenantId)
    .maybeSingle();

  if (tenantError || !tenant) {
    return { error: "Unable to load organization profile." };
  }

  const { error } = await supabase.rpc("update_organization_governance_profile", {
    p_legal_name: tenant.legal_name,
    p_primary_email: tenant.primary_email,
    p_primary_phone: tenant.primary_phone,
    p_location_governance_config_patch: buildDomRoutingPatch(parsed.data.dom_routing),
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("update_organization_governance_profile") };
    }
    return { error: error.message };
  }

  for (const path of LOCATION_PATHS) {
    revalidatePath(path);
  }

  return { success: true as const };
}
