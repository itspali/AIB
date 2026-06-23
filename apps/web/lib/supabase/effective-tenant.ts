import "server-only";

import { cache } from "react";
import { peekImpersonationFromCookies } from "@/lib/console/impersonation";
import type { ImpersonationPayload } from "@/lib/console/impersonation-cookie";

export type EffectiveTenantContext = {
  tenantId: string | null;
  impersonation: ImpersonationPayload | null;
};

async function loadEffectiveTenant(
  sessionTenantId: string | null | undefined
): Promise<EffectiveTenantContext> {
  const impersonation = await peekImpersonationFromCookies();
  if (impersonation?.tenantId) {
    return { tenantId: impersonation.tenantId, impersonation };
  }
  return { tenantId: sessionTenantId ?? null, impersonation: null };
}

/** Resolve tenant scope: impersonation cookie overrides JWT tenant_id when valid. */
export const resolveEffectiveTenant = cache(loadEffectiveTenant);
