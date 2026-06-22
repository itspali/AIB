import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, getServiceRoleKeyMismatch } from "@/lib/supabase/admin";
import { readSessionClaims } from "@/lib/supabase/auth";
import { readAalFromClaims, sessionSatisfiesConsoleMfa } from "@/lib/auth/mfa-policy";
import { getPlatformConfigValue } from "@/lib/console/platform-config";
import { roleAtLeast } from "@/lib/console/roles";
import type { AppConsoleRole, ConsoleOperator } from "@/lib/console/types";

export class ConsoleAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConsoleAccessError";
  }
}

async function fetchOperator(admin: NonNullable<ReturnType<typeof createAdminClient>>, userId: string) {
  const { data, error } = await admin
    .from("app_console_operators")
    .select("id, user_id, email, role, is_active, mfa_enforced, granted_at, notes")
    .eq("user_id", userId)
    .eq("is_active", true)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) {
    const hint =
      error.message.includes("timeout") || error.message.includes("ECONNRESET")
        ? " Database connection failed — check that the Supabase project is active."
        : "";
    throw new ConsoleAccessError(`${error.message}${hint}`);
  }
  return data as ConsoleOperator | null;
}

export type ConsoleAccess = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  admin: NonNullable<ReturnType<typeof createAdminClient>>;
  claims: NonNullable<Awaited<ReturnType<typeof readSessionClaims>>>;
  operator: ConsoleOperator;
};

export const requireConsoleAccess = cache(async (minRole: AppConsoleRole = "VIEWER"): Promise<ConsoleAccess> => {
  const supabase = await createClient();
  const claims = await readSessionClaims(supabase);
  if (!claims) redirect("/login?next=/console");

  const keyMismatch = getServiceRoleKeyMismatch();
  const admin = createAdminClient();
  if (!admin) {
    throw new ConsoleAccessError(
      keyMismatch ?? "App Console requires SUPABASE_SERVICE_ROLE_KEY on the server."
    );
  }

  const operator = await fetchOperator(admin, claims.userId);
  if (!operator) redirect("/console/unauthorized");

  if (!roleAtLeast(operator.role, minRole)) {
    throw new ConsoleAccessError(`Insufficient console role. Required: ${minRole}`);
  }

  const mfaRequired = await getPlatformConfigValue(admin, "console_mfa_required", true);
  const aal = readAalFromClaims(
    (await supabase.auth.getClaims()).data?.claims as Record<string, unknown> | undefined
  );

  if (!sessionSatisfiesConsoleMfa(aal, mfaRequired, operator.mfa_enforced)) {
    redirect(`/login/mfa-enroll?next=${encodeURIComponent("/console")}`);
  }

  return { supabase, admin, claims, operator };
});

/** Non-throwing check for middleware-free contexts. */
export async function getConsoleOperatorIfAny(): Promise<ConsoleOperator | null> {
  const supabase = await createClient();
  const claims = await readSessionClaims(supabase);
  if (!claims) return null;
  const admin = createAdminClient();
  if (!admin) return null;
  return fetchOperator(admin, claims.userId);
}
