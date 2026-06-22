import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { computeSignupIssueBucket } from "../pipeline-stage";
import { isMissingTableError, safeHeadCount } from "./safe-query";

export type StuckSignupCounts = {
  bucketA: number;
  bucketB: number;
  bucketC: number;
};

export type OverviewMetrics = {
  totalTenants: number;
  activeTenants: number;
  trialTenants: number;
  suspendedTenants: number;
  signups7d: number;
  stuckOnboarding: number;
  stuckSignups: StuckSignupCounts;
  trialsExpiring7d: number;
};

function sevenDaysAgoIso(): string {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 7);
  return cutoff.toISOString();
}

function sevenDaysFromNowIso(): string {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() + 7);
  return cutoff.toISOString();
}

async function countTrialsExpiring7d(admin: SupabaseClient): Promise<number> {
  const now = new Date().toISOString();
  const in7d = sevenDaysFromNowIso();
  const { count, error } = await admin
    .from("tenant_subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("status", "TRIALING")
    .gte("trial_ends_at", now)
    .lte("trial_ends_at", in7d);

  if (isMissingTableError(error)) return 0;
  return count ?? 0;
}

async function countSignups7d(admin: SupabaseClient): Promise<number> {
  const since = sevenDaysAgoIso();
  const { count, error } = await admin
    .from("tenants")
    .select("*", { count: "exact", head: true })
    .gte("created_at", since);
  const tenantCount = isMissingTableError(error) ? 0 : (count ?? 0);

  const { data: pageData, error: pageError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (pageError || !pageData?.users) {
    return tenantCount;
  }

  const authCount = pageData.users.filter((u) => u.created_at >= since).length;
  return Math.max(tenantCount, authCount);
}

async function countSuspendedTenants(admin: SupabaseClient): Promise<number> {
  const { count, error } = await admin
    .from("tenants")
    .select("*", { count: "exact", head: true })
    .or("status.eq.SUSPENDED,is_active.eq.false");
  if (isMissingTableError(error)) return 0;
  return count ?? 0;
}

async function countStuckOnboarding(admin: SupabaseClient): Promise<number> {
  const { data: tenants, error } = await admin
    .from("tenants")
    .select("id, onboarding_status")
    .neq("onboarding_status", "GO_LIVE_READY");

  if (error || !tenants?.length) return 0;

  const tenantIds = tenants.map((t) => t.id as string);
  const { data: locations, error: locError } = await admin
    .from("tenant_locations")
    .select("tenant_id")
    .in("tenant_id", tenantIds);

  if (isMissingTableError(locError)) {
    return tenants.length;
  }

  const withLocations = new Set((locations ?? []).map((l) => l.tenant_id as string));
  const withoutLocations = tenantIds.filter((id) => !withLocations.has(id)).length;
  const notGoLive = tenants.filter((t) => t.onboarding_status !== "GO_LIVE_READY").length;

  return Math.max(withoutLocations, notGoLive);
}

async function approximateStuckSignups(admin: SupabaseClient): Promise<StuckSignupCounts> {
  const counts: StuckSignupCounts = { bucketA: 0, bucketB: 0, bucketC: 0 };

  const { data: memberships, error: usersError } = await admin
    .from("user_tenant_memberships")
    .select("user_id, tenant_id");
  if (usersError) return counts;

  const publicUserIds = new Set((memberships ?? []).map((m) => m.user_id as string));
  const membershipByUser = new Map<string, string>();
  for (const row of memberships ?? []) {
    if (!membershipByUser.has(row.user_id as string)) {
      membershipByUser.set(row.user_id as string, row.tenant_id as string);
    }
  }

  const { data: tenants, error: tenantError } = await admin
    .from("tenants")
    .select("id, onboarding_status");
  if (tenantError) return counts;

  const tenantIds = (tenants ?? []).map((t) => t.id as string);
  const { data: locations, error: locError } = await admin
    .from("tenant_locations")
    .select("tenant_id")
    .in("tenant_id", tenantIds.length ? tenantIds : ["00000000-0000-0000-0000-000000000000"]);

  const tenantsWithLocations = new Set(
    isMissingTableError(locError) ? tenantIds : (locations ?? []).map((l) => l.tenant_id as string)
  );

  for (const tenant of tenants ?? []) {
    if (!tenantsWithLocations.has(tenant.id as string)) {
      counts.bucketB += 1;
    }
  }

  let page = 1;
  const perPage = 200;
  let hasMore = true;

  while (hasMore) {
    const { data: authPage, error: authError } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });
    if (authError || !authPage?.users?.length) break;

    for (const authUser of authPage.users) {
      const meta = (authUser.app_metadata ?? {}) as Record<string, unknown>;
      const userMeta = (authUser.user_metadata ?? {}) as Record<string, unknown>;
      const tenantIdInMetadata =
        typeof meta.tenant_id === "string" ? meta.tenant_id : null;
      const hasPublicUser = publicUserIds.has(authUser.id);
      const tenantId =
        membershipByUser.get(authUser.id) ?? tenantIdInMetadata;

      const issue = computeSignupIssueBucket({
        authUserId: authUser.id,
        hasPublicUser,
        tenantId,
        hasLocations: tenantId ? tenantsWithLocations.has(tenantId) : false,
        signupPending: userMeta.signup_pending === true,
        provisionDeferred: meta.provision_deferred === true,
        tenantIdInMetadata: Boolean(tenantIdInMetadata),
      });

      if (issue === "A") counts.bucketA += 1;
      else if (issue === "C") counts.bucketC += 1;
    }

    hasMore = authPage.users.length === perPage;
    page += 1;
    if (page > 25) break;
  }

  return counts;
}

export async function fetchOverviewMetrics(admin: SupabaseClient): Promise<OverviewMetrics> {
  const [
    totalTenants,
    activeTenants,
    trialTenants,
    suspendedTenants,
    signups7d,
    stuckOnboarding,
    stuckSignups,
    trialsExpiring7d,
  ] = await Promise.all([
    safeHeadCount(admin, "tenants"),
    safeHeadCount(admin, "tenants", { status: "ACTIVE", is_active: true }),
    safeHeadCount(admin, "tenants", { status: "TRIAL" }),
    countSuspendedTenants(admin),
    countSignups7d(admin),
    countStuckOnboarding(admin),
    approximateStuckSignups(admin),
    countTrialsExpiring7d(admin),
  ]);

  return {
    totalTenants,
    activeTenants,
    trialTenants,
    suspendedTenants,
    signups7d,
    stuckOnboarding,
    stuckSignups,
    trialsExpiring7d,
  };
}
