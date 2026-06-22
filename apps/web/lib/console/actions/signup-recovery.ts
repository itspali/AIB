"use server";

import { revalidatePath } from "next/cache";
import { requireConsoleAccess, ConsoleAccessError } from "../require-console";
import { logConsoleAction } from "../audit";

function revalidateSignupPaths() {
  revalidatePath("/console");
  revalidatePath("/console/signups");
  revalidatePath("/console/users");
  revalidatePath("/console/tenants");
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

export async function retryTenantProvision(authUserId: string) {
  try {
    const { admin, operator } = await requireConsoleAccess("OPERATOR");

    const { data: authUser, error: authError } = await admin.auth.admin.getUserById(authUserId);
    if (authError) return { error: authError.message };
    if (!authUser.user) return { error: "Auth user not found" };

    const user = authUser.user;
    const metadata = user.user_metadata ?? {};
    const companyName =
      (typeof metadata.company_name === "string" && metadata.company_name.trim()) ||
      (typeof metadata.companyName === "string" && metadata.companyName.trim()) ||
      "";
    const adminName =
      (typeof metadata.admin_name === "string" && metadata.admin_name.trim()) ||
      (typeof metadata.adminName === "string" && metadata.adminName.trim()) ||
      "";
    const email = user.email?.trim() ?? "";

    if (!companyName) return { error: "Company name missing from user metadata" };
    if (!adminName) return { error: "Admin name missing from user metadata" };
    if (!email) return { error: "Email missing from auth user" };

    const { data: tenantId, error: rpcError } = await admin.rpc("console_initialize_new_tenant", {
      company_name: companyName,
      admin_name: adminName,
      user_email: email,
      auth_user_id: authUserId,
    });

    if (rpcError) return { error: rpcError.message };

    await logConsoleAction({
      admin,
      operator,
      action: "SIGNUP_RETRY_PROVISION",
      targetType: "auth_user",
      targetId: authUserId,
      tenantId: tenantId ?? undefined,
      payload: { company_name: companyName, email },
    });

    revalidateSignupPaths();
    if (tenantId) {
      revalidatePath(`/console/tenants/${tenantId}`);
    }
    return { ok: true as const };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return actionError(error);
  }
}

export async function confirmAuthEmail(authUserId: string) {
  try {
    const { admin, operator } = await requireConsoleAccess("OPERATOR");

    const { data: authUser, error: authError } = await admin.auth.admin.updateUserById(authUserId, {
      email_confirm: true,
    });

    if (authError) return { error: authError.message };

    await logConsoleAction({
      admin,
      operator,
      action: "AUTH_EMAIL_CONFIRM",
      targetType: "auth_user",
      targetId: authUserId,
      payload: { email: authUser.user.email ?? null },
    });

    revalidateSignupPaths();
    return { ok: true as const };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return actionError(error);
  }
}

export async function sendPasswordReset(authUserId: string) {
  try {
    const { admin, operator } = await requireConsoleAccess("OPERATOR");

    const { data: authUser, error: lookupError } = await admin.auth.admin.getUserById(authUserId);
    if (lookupError) return { error: lookupError.message };
    if (!authUser.user?.email) return { error: "Auth user email not found" };

    const email = authUser.user.email;

    const { error: resetError } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
    });

    if (resetError) return { error: resetError.message };

    await logConsoleAction({
      admin,
      operator,
      action: "AUTH_PASSWORD_RESET",
      targetType: "auth_user",
      targetId: authUserId,
      payload: { email },
    });

    revalidateSignupPaths();
    return { ok: true as const };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return actionError(error);
  }
}
