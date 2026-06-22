import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  fetchOnboardingSnapshot,
  getTenantIdFromSession,
  hasWorkspaceAccess,
} from "@/lib/onboarding/status";
import { fetchOperatorProfileForSession } from "@/lib/user/queries";

export const getOnboardingPageContext = cache(async () => {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession(supabase);

  if (!tenantId) redirect("/signup");

  const [{ data: authData }, snapshot] = await Promise.all([
    supabase.auth.getUser(),
    fetchOnboardingSnapshot(supabase, tenantId),
  ]);

  if (!snapshot) redirect("/signup");

  const signupCountryCode =
    typeof authData.user?.user_metadata?.country_code === "string"
      ? authData.user.user_metadata.country_code
      : null;

  const orgName = snapshot.tenant.trade_name || snapshot.tenant.name;
  const operatorProfile = await fetchOperatorProfileForSession(supabase, orgName);
  const workspaceReady = hasWorkspaceAccess(snapshot);

  return {
    supabase,
    tenantId,
    snapshot,
    signupCountryCode,
    orgName,
    operatorProfile,
    workspaceReady,
  };
});
