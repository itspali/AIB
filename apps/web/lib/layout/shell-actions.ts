"use server";

import { fetchApprovalAlertCount } from "@/lib/dashboard/queries";
import { peekImpersonationFromCookies } from "@/lib/console/impersonation";
import { fetchThemePolicyForSession } from "@/lib/theme/queries";
import { fetchOperatorProfile } from "@/lib/user/queries";
import type { ResolvedThemePolicy } from "@/lib/theme/governance";
import type { OperatorProfile } from "@/lib/user/types";
import { requireTenantId, tryRequireTenantId } from "@/lib/supabase/require-tenant";

export async function fetchApprovalAlertCountAction(): Promise<number> {
  const { supabase, tenantId } = await requireTenantId();
  return fetchApprovalAlertCount(supabase, tenantId);
}

/** Hydrates sidebar/profile after SSR shell render (avoids ~6 queries per navigation). */
export async function fetchOperatorProfileAction(): Promise<OperatorProfile | null> {
  const impersonating = await peekImpersonationFromCookies();
  if (impersonating) return null;

  const ctx = await tryRequireTenantId();
  if (!ctx) return null;

  return fetchOperatorProfile(ctx.supabase, ctx.userId, ctx.tenantId);
}

/** Hydrates theme governance after SSR (avoids registry queries on every layout render). */
export async function fetchThemePolicyAction(): Promise<ResolvedThemePolicy | null> {
  const impersonating = await peekImpersonationFromCookies();
  if (impersonating) return null;

  const ctx = await tryRequireTenantId();
  if (!ctx) return null;

  return fetchThemePolicyForSession(ctx.supabase, ctx.tenantId, ctx.userId);
}
