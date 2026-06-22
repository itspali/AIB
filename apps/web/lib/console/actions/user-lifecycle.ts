"use server";

import { revalidatePath } from "next/cache";
import { requireConsoleAccess, ConsoleAccessError } from "../require-console";
import { logConsoleAction } from "../audit";

function revalidateUserPaths(tenantId: string) {
  revalidatePath("/console");
  revalidatePath("/console/tenants");
  revalidatePath(`/console/tenants/${tenantId}`);
  revalidatePath("/console/users");
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

export async function deactivateTenantUser(tenantId: string, userId: string, reason: string) {
  try {
    const trimmedReason = reason?.trim();
    if (!trimmedReason) return { error: "Reason is required" };

    const { admin, operator } = await requireConsoleAccess("OPERATOR");

    const { error: userError } = await admin
      .from("users")
      .update({ is_active: false })
      .eq("id", userId);

    if (userError) return { error: userError.message };

    const { error: membershipError } = await admin
      .from("user_tenant_memberships")
      .update({ is_active: false })
      .eq("tenant_id", tenantId)
      .eq("user_id", userId);

    if (membershipError) return { error: membershipError.message };

    await logConsoleAction({
      admin,
      operator,
      action: "USER_DEACTIVATE",
      targetType: "user",
      targetId: userId,
      tenantId,
      payload: { reason: trimmedReason },
    });

    revalidateUserPaths(tenantId);
    return { ok: true as const };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return actionError(error);
  }
}

export async function reactivateTenantUser(tenantId: string, userId: string) {
  try {
    const { admin, operator } = await requireConsoleAccess("OPERATOR");

    const { error: userError } = await admin
      .from("users")
      .update({ is_active: true })
      .eq("id", userId);

    if (userError) return { error: userError.message };

    const { error: membershipError } = await admin
      .from("user_tenant_memberships")
      .update({ is_active: true })
      .eq("tenant_id", tenantId)
      .eq("user_id", userId);

    if (membershipError) return { error: membershipError.message };

    await logConsoleAction({
      admin,
      operator,
      action: "USER_REACTIVATE",
      targetType: "user",
      targetId: userId,
      tenantId,
    });

    revalidateUserPaths(tenantId);
    return { ok: true as const };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return actionError(error);
  }
}
