import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  coerceProductListPrefs,
  type ProductListPrefs,
} from "@/lib/products/list-prefs";

export function parseUserProductListPrefs(raw: unknown): ProductListPrefs | null {
  if (!raw || typeof raw !== "object") return null;
  return coerceProductListPrefs(raw);
}

export async function loadUserProductListPrefs(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string
): Promise<ProductListPrefs | null> {
  const { data, error } = await supabase
    .from("users")
    .select("metadata_json")
    .eq("id", userId)
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return null;

  const metadata =
    data.metadata_json && typeof data.metadata_json === "object"
      ? (data.metadata_json as Record<string, unknown>)
      : {};

  return parseUserProductListPrefs(metadata.product_list_prefs);
}
