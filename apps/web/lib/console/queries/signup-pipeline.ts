import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  computePipelineStage,
  computeSignupIssueBucket,
  PIPELINE_STAGE_LABELS,
} from "../pipeline-stage";
import type {
  PipelineStage,
  SignupIssueBucket,
  TenantAccountStatus,
  TenantOnboardingSource,
  TenantOnboardingStatus,
} from "../types";
import { isMissingTableError } from "./safe-query";
import { loadMembershipsByUserIds, pickPrimaryMembership } from "./user-memberships";

export type SignupPipelineFilters = {
  search?: string;
  stage?: PipelineStage;
  accountStatus?: TenantAccountStatus;
  onboardingStatus?: TenantOnboardingStatus;
  onboardingSource?: TenantOnboardingSource;
  countryCode?: string;
  emailConfirmed?: boolean;
  issue?: SignupIssueBucket | "any";
  signupFrom?: string;
  signupTo?: string;
  trialExpiringWithinDays?: number;
  limit?: number;
  offset?: number;
};

export type SignupPipelineRow = {
  row_id: string;
  auth_user_id: string | null;
  tenant_id: string | null;
  signup_at: string;
  email: string | null;
  email_confirmed: boolean;
  company_name: string | null;
  organization_code: string | null;
  country_code: string | null;
  account_status: TenantAccountStatus | null;
  onboarding_status: TenantOnboardingStatus | string | null;
  onboarding_source: TenantOnboardingSource | null;
  pipeline_stage: PipelineStage;
  pipeline_stage_label: string;
  issue_bucket: SignupIssueBucket;
  plan_name: string | null;
  trial_ends_at: string | null;
};

export type SignupPipelineFunnel = Record<PipelineStage, number>;

export type SignupPipelineResult = {
  rows: SignupPipelineRow[];
  total: number;
  funnel: SignupPipelineFunnel;
};

type PublicUserRow = {
  id: string;
  tenant_id: string;
  email: string;
};

type TenantRow = {
  id: string;
  organization_code: string;
  name: string;
  status: TenantAccountStatus;
  is_active: boolean;
  onboarding_status: TenantOnboardingStatus;
  onboarding_source: TenantOnboardingSource;
  country_code: string | null;
  created_at: string;
};

type SubscriptionRow = {
  tenant_id: string;
  status: string;
  trial_ends_at: string | null;
  plan: { name: string; code: string } | { name: string; code: string }[] | null;
};

function emptyFunnel(): SignupPipelineFunnel {
  return {
    REGISTERED: 0,
    EMAIL_VERIFIED: 0,
    TENANT_CREATED: 0,
    ONBOARDING: 0,
    LIVE: 0,
    TRIAL: 0,
    PAYING: 0,
    CHURNED: 0,
  };
}

function resolvePlanName(plan: SubscriptionRow["plan"]): string | null {
  if (!plan) return null;
  if (Array.isArray(plan)) return plan[0]?.name ?? null;
  return plan.name ?? null;
}

function matchesSearch(row: SignupPipelineRow, search: string): boolean {
  const needle = search.toLowerCase();
  return (
    (row.email?.toLowerCase().includes(needle) ?? false) ||
    (row.company_name?.toLowerCase().includes(needle) ?? false) ||
    (row.organization_code?.toLowerCase().includes(needle) ?? false)
  );
}

function matchesFilters(
  row: SignupPipelineRow,
  filters: SignupPipelineFilters,
  trialEndsAt: string | null
): boolean {
  if (filters.search && !matchesSearch(row, filters.search.trim())) return false;
  if (filters.stage && row.pipeline_stage !== filters.stage) return false;
  if (filters.accountStatus && row.account_status !== filters.accountStatus) return false;
  if (filters.onboardingStatus && row.onboarding_status !== filters.onboardingStatus) return false;
  if (filters.onboardingSource && row.onboarding_source !== filters.onboardingSource) return false;
  if (filters.countryCode && row.country_code?.toUpperCase() !== filters.countryCode.toUpperCase()) {
    return false;
  }
  if (filters.emailConfirmed != null && row.email_confirmed !== filters.emailConfirmed) return false;
  if (filters.issue === "any" && !row.issue_bucket) return false;
  if (filters.issue && filters.issue !== "any" && row.issue_bucket !== filters.issue) return false;
  if (filters.signupFrom && row.signup_at < filters.signupFrom) return false;
  if (filters.signupTo && row.signup_at > filters.signupTo) return false;
  if (filters.trialExpiringWithinDays != null) {
    if (!trialEndsAt) return false;
    const end = new Date(trialEndsAt).getTime();
    const max = Date.now() + filters.trialExpiringWithinDays * 24 * 60 * 60 * 1000;
    if (end < Date.now() || end > max) return false;
  }
  return true;
}

async function loadSubscriptionMap(
  admin: SupabaseClient,
  tenantIds: string[]
): Promise<Map<string, SubscriptionRow>> {
  const map = new Map<string, SubscriptionRow>();
  if (!tenantIds.length) return map;

  const { data, error } = await admin
    .from("tenant_subscriptions")
    .select(
      `
      tenant_id,
      status,
      trial_ends_at,
      plan:subscription_plans (name, code)
    `
    )
    .in("tenant_id", tenantIds);

  if (isMissingTableError(error) || error) return map;
  for (const row of data ?? []) {
    map.set(row.tenant_id as string, row as SubscriptionRow);
  }
  return map;
}

async function loadLocationTenantIds(
  admin: SupabaseClient,
  tenantIds: string[]
): Promise<Set<string>> {
  const withLocations = new Set<string>();
  if (!tenantIds.length) return withLocations;

  const { data, error } = await admin
    .from("tenant_locations")
    .select("tenant_id")
    .in("tenant_id", tenantIds);

  if (isMissingTableError(error) || error) return withLocations;
  for (const row of data ?? []) {
    withLocations.add(row.tenant_id as string);
  }
  return withLocations;
}

function buildRowFromAuthUser(
  authUser: User,
  publicUser: PublicUserRow | undefined,
  tenant: TenantRow | undefined,
  hasLocations: boolean,
  subscription: SubscriptionRow | undefined
): SignupPipelineRow {
  const meta = (authUser.app_metadata ?? {}) as Record<string, unknown>;
  const userMeta = (authUser.user_metadata ?? {}) as Record<string, unknown>;
  const tenantIdInMetadata = typeof meta.tenant_id === "string" ? meta.tenant_id : null;
  const tenantId = publicUser?.tenant_id ?? tenant?.id ?? tenantIdInMetadata;
  const emailConfirmed = Boolean(authUser.email_confirmed_at);
  const planCode = subscription?.plan
    ? Array.isArray(subscription.plan)
      ? subscription.plan[0]?.code
      : subscription.plan.code
    : null;

  const pipelineStage = computePipelineStage({
    authUserId: authUser.id,
    emailConfirmed,
    hasPublicUser: Boolean(publicUser),
    tenantId,
    tenantActive: tenant?.is_active ?? null,
    tenantStatus: tenant?.status ?? null,
    onboardingStatus: tenant?.onboarding_status ?? null,
    hasLocations,
    subscriptionStatus: subscription?.status ?? null,
    isTrialPlan: planCode === "TRIAL",
  });

  const issueBucket = computeSignupIssueBucket({
    authUserId: authUser.id,
    hasPublicUser: Boolean(publicUser),
    tenantId,
    hasLocations,
    signupPending: userMeta.signup_pending === true,
    provisionDeferred: meta.provision_deferred === true,
    tenantIdInMetadata: Boolean(tenantIdInMetadata),
  });

  const companyName =
    tenant?.name ??
    (typeof userMeta.company_name === "string" ? userMeta.company_name : null);

  return {
    row_id: authUser.id,
    auth_user_id: authUser.id,
    tenant_id: tenantId,
    signup_at: authUser.created_at,
    email: authUser.email ?? publicUser?.email ?? null,
    email_confirmed: emailConfirmed,
    company_name: companyName,
    organization_code: tenant?.organization_code ?? null,
    country_code: tenant?.country_code ?? null,
    account_status: tenant?.status ?? null,
    onboarding_status: tenant?.onboarding_status ?? null,
    onboarding_source: tenant?.onboarding_source ?? null,
    pipeline_stage: pipelineStage,
    pipeline_stage_label: PIPELINE_STAGE_LABELS[pipelineStage],
    issue_bucket: issueBucket,
    plan_name: resolvePlanName(subscription?.plan ?? null),
    trial_ends_at: subscription?.trial_ends_at ?? null,
  };
}

async function enrichAuthUsers(
  admin: SupabaseClient,
  authUsers: User[]
): Promise<SignupPipelineRow[]> {
  if (!authUsers.length) return [];

  const authIds = authUsers.map((u) => u.id);
  const membershipMap = await loadMembershipsByUserIds(admin, authIds);

  const publicUserMap = new Map<string, PublicUserRow>();
  for (const authId of authIds) {
    const primary = pickPrimaryMembership(membershipMap.get(authId) ?? []);
    if (primary) {
      publicUserMap.set(authId, {
        id: primary.user_id,
        tenant_id: primary.tenant_id,
        email: primary.email,
      });
    }
  }

  const tenantIdSet = new Set<string>();
  for (const authUser of authUsers) {
    const meta = (authUser.app_metadata ?? {}) as Record<string, unknown>;
    const publicUser = publicUserMap.get(authUser.id);
    if (publicUser?.tenant_id) tenantIdSet.add(publicUser.tenant_id);
    if (typeof meta.tenant_id === "string") tenantIdSet.add(meta.tenant_id);
  }

  const tenantIds = [...tenantIdSet];
  const [{ data: tenants, error: tenantError }, locationIds, subscriptionMap] = await Promise.all([
    tenantIds.length
      ? admin
          .from("tenants")
          .select(
            "id, organization_code, name, status, is_active, onboarding_status, onboarding_source, country_code, created_at"
          )
          .in("id", tenantIds)
      : Promise.resolve({ data: [], error: null }),
    loadLocationTenantIds(admin, tenantIds),
    loadSubscriptionMap(admin, tenantIds),
  ]);

  if (tenantError) throw tenantError;

  const tenantMap = new Map<string, TenantRow>();
  for (const row of (tenants ?? []) as TenantRow[]) {
    tenantMap.set(row.id, row);
  }

  return authUsers.map((authUser) => {
    const publicUser = publicUserMap.get(authUser.id);
    const meta = (authUser.app_metadata ?? {}) as Record<string, unknown>;
    const tenantId =
      publicUser?.tenant_id ??
      (typeof meta.tenant_id === "string" ? meta.tenant_id : undefined);
    const tenant = tenantId ? tenantMap.get(tenantId) : undefined;
    const subscription = tenantId ? subscriptionMap.get(tenantId) : undefined;

    return buildRowFromAuthUser(
      authUser,
      publicUser,
      tenant,
      tenantId ? locationIds.has(tenantId) : false,
      subscription
    );
  });
}

async function computeFullFunnel(admin: SupabaseClient): Promise<SignupPipelineFunnel> {
  const funnel = emptyFunnel();
  let page = 1;
  const perPage = 200;

  while (page <= 50) {
    const { data: authPage, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !authPage?.users?.length) break;

    const enriched = await enrichAuthUsers(admin, authPage.users);
    for (const row of enriched) {
      funnel[row.pipeline_stage] += 1;
    }

    if (authPage.users.length < perPage) break;
    page += 1;
  }

  return funnel;
}

export async function fetchSignupPipeline(
  admin: SupabaseClient,
  filters: SignupPipelineFilters = {}
): Promise<SignupPipelineResult> {
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  const hasPostFilters = Boolean(
    filters.stage ||
      filters.accountStatus ||
      filters.onboardingStatus ||
      filters.onboardingSource ||
      filters.countryCode ||
      filters.emailConfirmed != null ||
      filters.issue ||
      filters.signupFrom ||
      filters.signupTo ||
      filters.trialExpiringWithinDays != null ||
      filters.search
  );

  const [funnel, totalPage] = await Promise.all([
    computeFullFunnel(admin),
    admin.auth.admin.listUsers({ page: 1, perPage: 1 }),
  ]);

  const filteredRows: SignupPipelineRow[] = [];
  const perPage = hasPostFilters ? 200 : Math.max(limit, 50);
  let page = Math.floor(offset / perPage) + 1;
  const skipInPage = hasPostFilters ? 0 : offset % perPage;
  let collected = 0;
  let targetSkip = hasPostFilters ? offset : skipInPage;

  while (collected < limit) {
    const { data: authPage, error: authError } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });
    if (authError) throw authError;
    if (!authPage?.users?.length) break;

    const enriched = await enrichAuthUsers(admin, authPage.users);

    for (const row of enriched) {
      if (!matchesFilters(row, filters, row.trial_ends_at)) continue;

      if (targetSkip > 0) {
        targetSkip -= 1;
        continue;
      }

      filteredRows.push(row);
      collected += 1;
      if (collected >= limit) break;
    }

    if (authPage.users.length < perPage) break;
    page += 1;
    if (page > 100) break;
  }

  const totalUsers =
    totalPage.data && "total" in totalPage.data ? totalPage.data.total : filteredRows.length;
  const total = hasPostFilters ? filteredRows.length : totalUsers;

  return {
    rows: filteredRows,
    total,
    funnel,
  };
}
