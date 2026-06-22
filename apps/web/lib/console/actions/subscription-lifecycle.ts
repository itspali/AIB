"use server";

import { revalidatePath } from "next/cache";
import { requireConsoleAccess, ConsoleAccessError } from "../require-console";
import { logConsoleAction } from "../audit";
import { syncTenantAccessFromSubscription } from "../sync-subscription";

function revalidateSubscriptionPaths(tenantId: string) {
  revalidatePath("/console");
  revalidatePath("/console/subscriptions");
  revalidatePath("/console/trials");
  revalidatePath("/console/tenants");
  revalidatePath(`/console/tenants/${tenantId}`);
  revalidatePath("/console/signups");
}

function actionError(error: unknown): { error: string } {
  if (error instanceof ConsoleAccessError) return { error: error.message };
  if (error instanceof Error) return { error: error.message };
  return { error: "Unexpected error" };
}

function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: string }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

export async function extendTrial(tenantId: string, days: number, reason?: string) {
  try {
    if (!Number.isFinite(days) || days <= 0) {
      return { error: "Days must be a positive number" };
    }

    const { admin, operator } = await requireConsoleAccess("OPERATOR");

    const { data: sub, error: lookupError } = await admin
      .from("tenant_subscriptions")
      .select("id, trial_ends_at, status")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (lookupError) return { error: lookupError.message };
    if (!sub) return { error: "Subscription not found for tenant" };

    const baseDate = sub.trial_ends_at ? new Date(sub.trial_ends_at) : new Date();
    const trialEndsAt = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);

    const { error } = await admin
      .from("tenant_subscriptions")
      .update({
        status: "TRIALING",
        trial_ends_at: trialEndsAt.toISOString(),
      })
      .eq("tenant_id", tenantId);

    if (error) return { error: error.message };

    await syncTenantAccessFromSubscription(admin, tenantId);

    await logConsoleAction({
      admin,
      operator,
      action: "TRIAL_EXTEND",
      targetType: "tenant_subscription",
      targetId: sub.id,
      tenantId,
      payload: { days, trial_ends_at: trialEndsAt.toISOString(), reason: reason?.trim() || null },
    });

    revalidateSubscriptionPaths(tenantId);
    return { ok: true as const };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return actionError(error);
  }
}

export async function convertToPaid(tenantId: string, planId: string) {
  try {
    const { admin, operator, claims } = await requireConsoleAccess("OPERATOR");

    const now = new Date().toISOString();

    const { data: sub, error } = await admin
      .from("tenant_subscriptions")
      .update({
        plan_id: planId,
        status: "ACTIVE",
        current_period_start: now,
        trial_ends_at: null,
        assigned_by: claims.userId,
      })
      .eq("tenant_id", tenantId)
      .select("id")
      .maybeSingle();

    if (error) return { error: error.message };
    if (!sub) return { error: "Subscription not found for tenant" };

    await syncTenantAccessFromSubscription(admin, tenantId);

    await logConsoleAction({
      admin,
      operator,
      action: "TRIAL_CONVERT",
      targetType: "tenant_subscription",
      targetId: sub.id,
      tenantId,
      payload: { plan_id: planId },
    });

    revalidateSubscriptionPaths(tenantId);
    return { ok: true as const };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return actionError(error);
  }
}

export async function changePlan(tenantId: string, planId: string) {
  try {
    const { admin, operator, claims } = await requireConsoleAccess("OPERATOR");

    const { data: sub, error } = await admin
      .from("tenant_subscriptions")
      .update({
        plan_id: planId,
        assigned_by: claims.userId,
      })
      .eq("tenant_id", tenantId)
      .select("id")
      .maybeSingle();

    if (error) return { error: error.message };
    if (!sub) return { error: "Subscription not found for tenant" };

    await syncTenantAccessFromSubscription(admin, tenantId);

    await logConsoleAction({
      admin,
      operator,
      action: "SUBSCRIPTION_CHANGE_PLAN",
      targetType: "tenant_subscription",
      targetId: sub.id,
      tenantId,
      payload: { plan_id: planId },
    });

    revalidateSubscriptionPaths(tenantId);
    return { ok: true as const };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return actionError(error);
  }
}

export async function endTrial(tenantId: string, reason: string) {
  try {
    const trimmedReason = reason?.trim();
    if (!trimmedReason) return { error: "Reason is required" };

    const { admin, operator } = await requireConsoleAccess("OPERATOR");

    const { data: sub, error } = await admin
      .from("tenant_subscriptions")
      .update({
        status: "EXPIRED",
        trial_ends_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .select("id")
      .maybeSingle();

    if (error) return { error: error.message };
    if (!sub) return { error: "Subscription not found for tenant" };

    await syncTenantAccessFromSubscription(admin, tenantId);

    await logConsoleAction({
      admin,
      operator,
      action: "TRIAL_END",
      targetType: "tenant_subscription",
      targetId: sub.id,
      tenantId,
      payload: { reason: trimmedReason },
    });

    revalidateSubscriptionPaths(tenantId);
    return { ok: true as const };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return actionError(error);
  }
}

export async function markPastDue(tenantId: string) {
  try {
    const { admin, operator } = await requireConsoleAccess("OPERATOR");

    const { data: sub, error } = await admin
      .from("tenant_subscriptions")
      .update({ status: "PAST_DUE" })
      .eq("tenant_id", tenantId)
      .select("id")
      .maybeSingle();

    if (error) return { error: error.message };
    if (!sub) return { error: "Subscription not found for tenant" };

    await syncTenantAccessFromSubscription(admin, tenantId);

    await logConsoleAction({
      admin,
      operator,
      action: "SUBSCRIPTION_MARK_PAST_DUE",
      targetType: "tenant_subscription",
      targetId: sub.id,
      tenantId,
    });

    revalidateSubscriptionPaths(tenantId);
    return { ok: true as const };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return actionError(error);
  }
}
