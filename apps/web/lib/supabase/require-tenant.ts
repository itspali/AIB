import { createClient } from "@/lib/supabase/server";
import { readSessionClaims } from "@/lib/supabase/auth";

export async function requireTenantId() {
  const supabase = await createClient();
  const claims = await readSessionClaims(supabase);
  if (!claims) throw new Error("Not authenticated");
  if (!claims.tenantId) throw new Error("Tenant context missing from session");
  return {
    supabase,
    tenantId: claims.tenantId,
    userId: claims.userId,
    email: claims.email,
  };
}
