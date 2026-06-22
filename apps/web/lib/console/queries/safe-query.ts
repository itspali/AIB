import type { SupabaseClient } from "@supabase/supabase-js";

export function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    message.includes("could not find the table") ||
    message.includes("schema cache") ||
    (message.includes("relation") && message.includes("does not exist"))
  );
}

export async function safeHeadCount(
  admin: SupabaseClient,
  table: string,
  filters?: Record<string, string | boolean | number>
): Promise<number> {
  let query = admin.from(table).select("*", { count: "exact", head: true });
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value);
    }
  }
  const { count, error } = await query;
  if (isMissingTableError(error)) return 0;
  if (error) return 0;
  return count ?? 0;
}

export async function safeTenantHeadCount(
  admin: SupabaseClient,
  table: string,
  tenantId: string
): Promise<number> {
  return safeHeadCount(admin, table, { tenant_id: tenantId });
}

export async function tableExists(admin: SupabaseClient, table: string): Promise<boolean> {
  const { error } = await admin.from(table).select("*", { head: true, count: "exact" }).limit(0);
  return !isMissingTableError(error);
}
