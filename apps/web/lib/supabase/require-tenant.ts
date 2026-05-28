import { createClient } from "@/lib/supabase/server";

export async function requireTenantId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const tenantId = user.app_metadata?.tenant_id as string | undefined;
  if (!tenantId) throw new Error("Tenant context missing from session");
  return { supabase, tenantId };
}
