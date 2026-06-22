import "server-only";

import { readImpersonationFromCookies } from "@/lib/console/impersonation";
import { syncImpersonationJwtIfNeeded } from "@/lib/console/impersonation-jwt";
import type { ImpersonationPayload } from "@/lib/console/impersonation-cookie";

export type EffectiveTenantContext = {
  tenantId: string | null;
  impersonation: ImpersonationPayload | null;
};

/** Resolve tenant scope: impersonation cookie overrides JWT tenant_id when valid. */
export async function resolveEffectiveTenant(
  sessionTenantId: string | null | undefined
): Promise<EffectiveTenantContext> {
  const impersonation = await readImpersonationFromCookies();
  if (impersonation?.tenantId) {
    const syncError = await syncImpersonationJwtIfNeeded(impersonation);
    if (syncError) {
      return { tenantId: sessionTenantId ?? null, impersonation: null };
    }
    return { tenantId: impersonation.tenantId, impersonation };
  }
  return { tenantId: sessionTenantId ?? null, impersonation: null };
}
