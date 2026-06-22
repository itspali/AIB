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

/** One Supabase client + JWT verify per server-action request. */
export const requireTenantId = cache(async (): Promise<TenantContext> => {
  const supabase = await createClient();
  const claims = await readSessionClaims(supabase);
  if (!claims) throw new Error("Not authenticated");

  const { tenantId, impersonation } = await resolveEffectiveTenant(claims.tenantId);
  if (!tenantId) throw new Error("Tenant context missing from session");

  return {
    supabase,
    tenantId,
    userId: claims.userId,
    email: claims.email,
    impersonation,
  };
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
