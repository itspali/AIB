"use server";

import { revalidatePath } from "next/cache";
import { requireConsoleAccess, ConsoleAccessError } from "../require-console";
import { logConsoleAction } from "../audit";
import type { TenantAccountStatus, TenantOnboardingStatus } from "../types";

function revalidateTenantPaths(tenantId: string) {
  revalidatePath("/console");
  revalidatePath("/console/tenants");
  revalidatePath(`/console/tenants/${tenantId}`);
  revalidatePath("/console/signups");
  revalidatePath("/console/subscriptions");
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

function requireReason(reason: string | undefined, label: string): string | { error: string } {
  const trimmed = reason?.trim();
  if (!trimmed) return { error: `${label} is required` };
  return trimmed;
}

export async function suspendTenant(tenantId: string, reason: string) {
  try {
    const reasonResult = requireReason(reason, "Reason");
    if (typeof reasonResult !== "string") return reasonResult;

    const { admin, operator } = await requireConsoleAccess("OPERATOR");

    const { error } = await admin
      .from("tenants")
      .update({ is_active: false, status: "SUSPENDED" })
      .eq("id", tenantId);

    if (error) return { error: error.message };

    await logConsoleAction({
      admin,
      operator,
      action: "TENANT_SUSPEND",
      targetType: "tenant",
      targetId: tenantId,
      tenantId,
      payload: { reason: reasonResult },
    });

    revalidateTenantPaths(tenantId);
    return { ok: true as const };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return actionError(error);
  }
}

export async function reactivateTenant(tenantId: string) {
  try {
    const { admin, operator } = await requireConsoleAccess("OPERATOR");

    const { error } = await admin
      .from("tenants")
      .update({ is_active: true, status: "ACTIVE" })
      .eq("id", tenantId);

    if (error) return { error: error.message };

    await logConsoleAction({
      admin,
      operator,
      action: "TENANT_REACTIVATE",
      targetType: "tenant",
      targetId: tenantId,
      tenantId,
    });

    revalidateTenantPaths(tenantId);
    return { ok: true as const };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return actionError(error);
  }
}

export async function updateTenantStatus(tenantId: string, status: TenantAccountStatus) {
  try {
    const { admin, operator } = await requireConsoleAccess("OPERATOR");

    const isActive = status !== "SUSPENDED";

    const { error } = await admin
      .from("tenants")
      .update({ status, is_active: isActive })
      .eq("id", tenantId);

    if (error) return { error: error.message };

    await logConsoleAction({
      admin,
      operator,
      action: "TENANT_STATUS_UPDATE",
      targetType: "tenant",
      targetId: tenantId,
      tenantId,
      payload: { status, is_active: isActive },
    });

    revalidateTenantPaths(tenantId);
    return { ok: true as const };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return actionError(error);
  }
}

export async function forceOnboardingStatus(
  tenantId: string,
  onboardingStatus: TenantOnboardingStatus,
  reason: string
) {
  try {
    const reasonResult = requireReason(reason, "Reason");
    if (typeof reasonResult !== "string") return reasonResult;

    const { admin, operator } = await requireConsoleAccess("OPERATOR");

    const { error } = await admin
      .from("tenants")
      .update({ onboarding_status: onboardingStatus })
      .eq("id", tenantId);

    if (error) return { error: error.message };

    await logConsoleAction({
      admin,
      operator,
      action: "ONBOARDING_FORCE_STATUS",
      targetType: "tenant",
      targetId: tenantId,
      tenantId,
      payload: { onboarding_status: onboardingStatus, reason: reasonResult },
    });

    revalidateTenantPaths(tenantId);
    return { ok: true as const };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return actionError(error);
  }
}
