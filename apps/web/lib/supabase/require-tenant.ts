import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { readSessionClaims } from "@/lib/supabase/auth";
import { resolveEffectiveTenant } from "@/lib/supabase/effective-tenant";
import type { ImpersonationPayload } from "@/lib/console/impersonation-cookie";
import { isWorkspaceDeletionPending } from "@/lib/organization/deletion";
import { assertNotReadOnlyImpersonation } from "@/lib/console/impersonation";

export type TenantContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  tenantId: string;
  userId: string;
  email: string | null;
  impersonation: ImpersonationPayload | null;
};

async function loadTenantContext(): Promise<TenantContext | null> {
  const supabase = await createClient();
  const claims = await readSessionClaims(supabase);
  if (!claims) return null;

  const { tenantId, impersonation } = await resolveEffectiveTenant(claims.tenantId);
  if (!tenantId) return null;

  return {
    supabase,
    tenantId,
    userId: claims.userId,
    email: claims.email,
    impersonation,
  };
}

/** Tenant context when present; null on public/unauthenticated routes. */
export const tryRequireTenantId = cache(loadTenantContext);

/** One Supabase client + JWT verify per server-action request. */
export const requireTenantId = cache(async (): Promise<TenantContext> => {
  const ctx = await tryRequireTenantId();
  if (!ctx) throw new Error("Not authenticated");
  return ctx;
});

/** Tenant context for mutating server actions (read-only impersonation blocked in middleware). */
export const requireTenantMutation = cache(async (): Promise<TenantContext> => {
  await assertNotReadOnlyImpersonation();

  const ctx = await requireTenantId();

  if (await isWorkspaceDeletionPending(ctx.supabase, ctx.tenantId)) {
    throw new Error(
      "This workspace is scheduled for deletion and is read-only. Cancel the deletion from Organization settings.",
    );
  }

  return ctx;
});
