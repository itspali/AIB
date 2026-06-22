"use server";

import { revalidatePath } from "next/cache";
import { requireConsoleAccess, ConsoleAccessError } from "../require-console";
import { logConsoleAction } from "../audit";
import type { SubscriptionPlanInterval } from "../types";

function revalidatePlanPaths(planId?: string) {
  revalidatePath("/console");
  revalidatePath("/console/plans");
  revalidatePath("/console/subscriptions");
  if (planId) {
    revalidatePath(`/console/plans/${planId}`);
  }
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

export type PlanInput = {
  code: string;
  name: string;
  description?: string;
  price_amount?: number;
  price_currency?: string;
  billing_interval?: SubscriptionPlanInterval;
  trial_days?: number;
  limits_json?: Record<string, unknown>;
  features_json?: Record<string, unknown>;
  is_public?: boolean;
  sort_order?: number;
  stripe_product_id?: string;
  stripe_price_id?: string;
  metadata_json?: Record<string, unknown>;
};

export async function createPlan(input: PlanInput) {
  try {
    const code = input.code?.trim();
    const name = input.name?.trim();
    if (!code) return { error: "Plan code is required" };
    if (!name) return { error: "Plan name is required" };

    const { admin, operator } = await requireConsoleAccess("ADMIN");

    const { data: plan, error } = await admin
      .from("subscription_plans")
      .insert({
        code: code.toUpperCase(),
        name,
        description: input.description?.trim() || null,
        price_amount: input.price_amount ?? 0,
        price_currency: input.price_currency?.trim().toUpperCase() || "USD",
        billing_interval: input.billing_interval ?? "MONTHLY",
        trial_days: input.trial_days ?? 0,
        limits_json: input.limits_json ?? {},
        features_json: input.features_json ?? {},
        is_public: input.is_public ?? true,
        sort_order: input.sort_order ?? 0,
        stripe_product_id: input.stripe_product_id?.trim() || null,
        stripe_price_id: input.stripe_price_id?.trim() || null,
        metadata_json: input.metadata_json ?? {},
      })
      .select("id")
      .single();

    if (error) return { error: error.message };

    await logConsoleAction({
      admin,
      operator,
      action: "PLAN_CREATE",
      targetType: "subscription_plan",
      targetId: plan.id,
      payload: { code, name },
    });

    revalidatePlanPaths(plan.id);
    return { ok: true as const };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return actionError(error);
  }
}

export async function updatePlan(planId: string, input: Partial<PlanInput>) {
  try {
    const { admin, operator } = await requireConsoleAccess("ADMIN");

    const patch: Record<string, unknown> = {};
    if (input.code !== undefined) patch.code = input.code.trim().toUpperCase();
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.description !== undefined) patch.description = input.description.trim() || null;
    if (input.price_amount !== undefined) patch.price_amount = input.price_amount;
    if (input.price_currency !== undefined) {
      patch.price_currency = input.price_currency.trim().toUpperCase();
    }
    if (input.billing_interval !== undefined) patch.billing_interval = input.billing_interval;
    if (input.trial_days !== undefined) patch.trial_days = input.trial_days;
    if (input.limits_json !== undefined) patch.limits_json = input.limits_json;
    if (input.features_json !== undefined) patch.features_json = input.features_json;
    if (input.is_public !== undefined) patch.is_public = input.is_public;
    if (input.sort_order !== undefined) patch.sort_order = input.sort_order;
    if (input.stripe_product_id !== undefined) {
      patch.stripe_product_id = input.stripe_product_id.trim() || null;
    }
    if (input.stripe_price_id !== undefined) {
      patch.stripe_price_id = input.stripe_price_id.trim() || null;
    }
    if (input.metadata_json !== undefined) patch.metadata_json = input.metadata_json;

    if (Object.keys(patch).length === 0) {
      return { error: "No fields to update" };
    }

    const { error } = await admin.from("subscription_plans").update(patch).eq("id", planId);

    if (error) return { error: error.message };

    await logConsoleAction({
      admin,
      operator,
      action: "PLAN_UPDATE",
      targetType: "subscription_plan",
      targetId: planId,
      payload: patch,
    });

    revalidatePlanPaths(planId);
    return { ok: true as const };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return actionError(error);
  }
}

export async function archivePlan(planId: string) {
  try {
    const { admin, operator } = await requireConsoleAccess("ADMIN");

    const { error } = await admin
      .from("subscription_plans")
      .update({ is_active: false, is_public: false })
      .eq("id", planId);

    if (error) return { error: error.message };

    await logConsoleAction({
      admin,
      operator,
      action: "PLAN_ARCHIVE",
      targetType: "subscription_plan",
      targetId: planId,
    });

    revalidatePlanPaths(planId);
    return { ok: true as const };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return actionError(error);
  }
}
