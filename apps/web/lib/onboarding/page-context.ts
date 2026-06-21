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

  const snapshot = await fetchOnboardingSnapshot(supabase, tenantId);
  if (!snapshot) redirect("/signup");

  const orgName = snapshot.tenant.trade_name || snapshot.tenant.name;
  const operatorProfile = await fetchOperatorProfileForSession(supabase, orgName);
  const workspaceReady = hasWorkspaceAccess(snapshot);

  return {
    supabase,
    tenantId,
    snapshot,
    orgName,
    operatorProfile,
    workspaceReady,
  };
});
