import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { readSessionClaims, type SessionClaims } from "@/lib/supabase/session-claims";
import { resolveEffectiveTenant } from "@/lib/supabase/effective-tenant";

// Re-export the client-safe claim helpers so existing server-side imports of
// this module keep working unchanged.
export { claimsToUserShape, readSessionClaims } from "@/lib/supabase/session-claims";
export type { SessionClaims } from "@/lib/supabase/session-claims";

/**
 * Request-scoped session claims. `cache()` dedupes the verification so a layout
 * and the page it wraps share a single call within one render pass.
 */
export const getSessionClaims = cache(async (): Promise<SessionClaims | null> => {
  const supabase = await createClient();
  return readSessionClaims(supabase);
});

export async function getSessionTenantId(): Promise<string | null> {
  const claims = await getSessionClaims();
  const { tenantId } = await resolveEffectiveTenant(claims?.tenantId);
  return tenantId;
}
