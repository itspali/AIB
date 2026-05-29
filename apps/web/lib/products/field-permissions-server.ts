import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mergeProductFieldPermissions,
  parseTenantProductFieldsAccess,
  type ProductFieldPermissions,
} from "@/lib/products/field-permissions";
import type { UserRole } from "@/lib/user/types";

export async function resolveProductFieldPermissions(
  supabase: SupabaseClient,
  tenantId: string,
  role: UserRole
): Promise<ProductFieldPermissions> {
  const { data, error } = await supabase
    .from("tenants")
    .select("metadata_json")
    .eq("id", tenantId)
    .maybeSingle();

  if (error || !data) {
    return mergeProductFieldPermissions(role, null);
  }

  const metadata =
    data.metadata_json && typeof data.metadata_json === "object"
      ? (data.metadata_json as Record<string, unknown>)
      : {};

  const tenantOverride = parseTenantProductFieldsAccess(metadata.product_fields_access);
  return mergeProductFieldPermissions(role, tenantOverride);
}

export async function resolveSessionProductFieldPermissions(
  supabase: SupabaseClient,
  tenantId: string
): Promise<ProductFieldPermissions | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: userRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const role = (userRow?.role as UserRole | undefined) ?? null;
  if (!role) return null;

  return resolveProductFieldPermissions(supabase, tenantId, role);
}
