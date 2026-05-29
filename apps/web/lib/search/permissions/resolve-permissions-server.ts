import "server-only";

import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SEARCH_FIELD_REGISTRY } from "@/lib/search/permissions/field-registry";
import { resolveProductFieldPermissions } from "@/lib/products/field-permissions-server";
import type { SearchFieldPermissions } from "@/lib/search/types";
import type { UserRole } from "@/lib/user/types";

export const SEARCH_FINANCIAL_FIELDS_KEY = "SEARCH_SETTINGS";

function defaultFinancialVisible(role: UserRole): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "MANAGER";
}

export async function resolveSearchFieldPermissionsFromSession(
  supabase: SupabaseClient,
  tenantId: string,
  _userId: string,
  role: UserRole
): Promise<SearchFieldPermissions> {
  const [{ data }, productPermissions] = await Promise.all([
    supabase
      .from("workspace_control_registry")
      .select("configuration_metadata")
      .eq("tenant_id", tenantId)
      .eq("registry_key", SEARCH_FINANCIAL_FIELDS_KEY)
      .eq("scope_level", "TENANT_GLOBAL")
      .is("target_reference_id", null)
      .maybeSingle(),
    resolveProductFieldPermissions(supabase, tenantId, role),
  ]);

  const meta = data?.configuration_metadata as Record<string, unknown> | null;
  const registryFlag = meta?.search_financial_fields_visible;
  const financialVisible =
    typeof registryFlag === "boolean" ? registryFlag : defaultFinancialVisible(role);

  const productAllowed = new Set<string>(productPermissions.allowedFields);

  const allowedFields = SEARCH_FIELD_REGISTRY.filter((entry) => {
    if (entry.scopes.includes("items") && productAllowed.has(entry.key)) {
      return true;
    }
    if (!entry.scopes.includes("items")) {
      if (entry.sensitivity === "financial" && !financialVisible) return false;
      return true;
    }
    return false;
  }).map((entry) => entry.key);

  return {
    financialVisible,
    allowedFields: [...new Set(allowedFields)],
    throttled: false,
  };
}

export function hashQuery(rawQuery: string): string {
  return createHash("sha256").update(rawQuery).digest("hex");
}
