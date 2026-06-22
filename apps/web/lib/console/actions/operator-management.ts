"use server";

import { revalidatePath } from "next/cache";
import { requireConsoleAccess, ConsoleAccessError } from "../require-console";
import { logConsoleAction } from "../audit";
import type { AppConsoleRole } from "../types";

function revalidateOperatorPaths() {
  revalidatePath("/console");
  revalidatePath("/console/settings/admins");
  revalidatePath("/console/audit");
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

async function countActiveAdmins(admin: Awaited<ReturnType<typeof requireConsoleAccess>>["admin"]) {
  const { count, error } = await admin
    .from("app_console_operators")
    .select("*", { count: "exact", head: true })
    .eq("role", "ADMIN")
    .eq("is_active", true)
    .is("revoked_at", null);

  if (error) throw new ConsoleAccessError(error.message);
  return count ?? 0;
}

async function lookupAuthUserByEmail(
  admin: Awaited<ReturnType<typeof requireConsoleAccess>>["admin"],
  email: string
) {
  const normalized = email.trim().toLowerCase();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new ConsoleAccessError("Admin client unavailable");
  }

  const response = await fetch(
    `${url}/auth/v1/admin/users?filter=${encodeURIComponent(`email.eq.${normalized}`)}`,
    {
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new ConsoleAccessError(body || "Failed to lookup auth user");
  }

  const payload = (await response.json()) as { users?: Array<{ id: string; email?: string }> };
  return payload.users?.[0] ?? null;
}

export async function grantOperator(input: {
  email: string;
  role: AppConsoleRole;
  notes?: string;
}) {
  try {
    const email = input.email?.trim().toLowerCase();
    if (!email) return { error: "Email is required" };

    const { admin, operator, claims } = await requireConsoleAccess("ADMIN");

    const authUser = await lookupAuthUserByEmail(admin, email);
    if (!authUser) return { error: "No auth user found for that email" };

    const { data: existing } = await admin
      .from("app_console_operators")
      .select("id, is_active, revoked_at")
      .eq("user_id", authUser.id)
      .maybeSingle();

    if (existing?.is_active && !existing.revoked_at) {
      return { error: "Operator already has active console access" };
    }

    if (existing) {
      const { error } = await admin
        .from("app_console_operators")
        .update({
          email,
          role: input.role,
          is_active: true,
          revoked_at: null,
          granted_by: claims.userId,
          granted_at: new Date().toISOString(),
          notes: input.notes?.trim() || null,
        })
        .eq("id", existing.id);

      if (error) return { error: error.message };

      await logConsoleAction({
        admin,
        operator,
        action: "INTERNAL_ADMIN_GRANT",
        targetType: "console_operator",
        targetId: existing.id,
        payload: { email, role: input.role, reactivated: true },
      });
    } else {
      const { data: created, error } = await admin
        .from("app_console_operators")
        .insert({
          user_id: authUser.id,
          email,
          role: input.role,
          granted_by: claims.userId,
          notes: input.notes?.trim() || null,
        })
        .select("id")
        .single();

      if (error) return { error: error.message };

      await logConsoleAction({
        admin,
        operator,
        action: "INTERNAL_ADMIN_GRANT",
        targetType: "console_operator",
        targetId: created.id,
        payload: { email, role: input.role },
      });
    }

    revalidateOperatorPaths();
    return { ok: true as const };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return actionError(error);
  }
}

export async function revokeOperator(operatorId: string) {
  try {
    const { admin, operator } = await requireConsoleAccess("ADMIN");

    const { data: target, error: lookupError } = await admin
      .from("app_console_operators")
      .select("id, role, is_active, revoked_at, email")
      .eq("id", operatorId)
      .maybeSingle();

    if (lookupError) return { error: lookupError.message };
    if (!target) return { error: "Operator not found" };
    if (!target.is_active || target.revoked_at) {
      return { error: "Operator is already revoked" };
    }

    if (target.role === "ADMIN") {
      const adminCount = await countActiveAdmins(admin);
      if (adminCount <= 1) {
        return { error: "Cannot revoke the last active ADMIN operator" };
      }
    }

    const { error } = await admin
      .from("app_console_operators")
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
      })
      .eq("id", operatorId);

    if (error) return { error: error.message };

    await logConsoleAction({
      admin,
      operator,
      action: "INTERNAL_ADMIN_REVOKE",
      targetType: "console_operator",
      targetId: operatorId,
      payload: { email: target.email, role: target.role },
    });

    revalidateOperatorPaths();
    return { ok: true as const };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return actionError(error);
  }
}

export async function updateOperatorRole(operatorId: string, role: AppConsoleRole) {
  try {
    const { admin, operator } = await requireConsoleAccess("ADMIN");

    const { data: target, error: lookupError } = await admin
      .from("app_console_operators")
      .select("id, role, is_active, revoked_at, email")
      .eq("id", operatorId)
      .maybeSingle();

    if (lookupError) return { error: lookupError.message };
    if (!target) return { error: "Operator not found" };
    if (!target.is_active || target.revoked_at) {
      return { error: "Cannot update role of a revoked operator" };
    }

    if (target.role === "ADMIN" && role !== "ADMIN") {
      const adminCount = await countActiveAdmins(admin);
      if (adminCount <= 1) {
        return { error: "Cannot demote the last active ADMIN operator" };
      }
    }

    const { error } = await admin
      .from("app_console_operators")
      .update({ role })
      .eq("id", operatorId);

    if (error) return { error: error.message };

    await logConsoleAction({
      admin,
      operator,
      action: "INTERNAL_ADMIN_GRANT",
      targetType: "console_operator",
      targetId: operatorId,
      payload: { email: target.email, previous_role: target.role, role },
    });

    revalidateOperatorPaths();
    return { ok: true as const };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return actionError(error);
  }
}
