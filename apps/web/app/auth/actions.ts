"use server";

import { resolvePostLoginRoute } from "@/lib/auth/post-login-route";
import { getTenantIdFromSession } from "@/lib/onboarding/status";
import { createClient } from "@/lib/supabase/server";

export async function getPostLoginRoute() {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession(supabase);

  if (!tenantId) {
    return { redirectTo: "/onboarding" as const };
  }

  const redirectTo = await resolvePostLoginRoute(supabase, tenantId);
  return { redirectTo };
}
