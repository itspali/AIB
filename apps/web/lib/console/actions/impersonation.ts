"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireConsoleAccess, ConsoleAccessError } from "../require-console";
import { logConsoleAction } from "../audit";
import {
  encodeImpersonationCookie,
  IMPERSONATION_COOKIE_NAME,
  decodeImpersonationCookie,
} from "../impersonation-cookie";
import { applyImpersonationJwt, restoreImpersonationJwt } from "../impersonation-jwt";

const DEFAULT_SESSION_MS = 60 * 60 * 1000;

function revalidateImpersonationPaths(tenantId?: string) {
  revalidatePath("/console");
  if (tenantId) {
    revalidatePath(`/console/tenants/${tenantId}`);
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

export async function startImpersonation(input: {
  tenantId: string;
  targetUserId?: string | null;
  mode?: "READ_ONLY" | "WRITE";
  reason: string;
}) {
  try {
    const trimmedReason = input.reason?.trim();
    if (!trimmedReason) return { error: "Reason is required" };

    const mode = input.mode ?? "READ_ONLY";
    const minRole = mode === "WRITE" ? "ADMIN" : "OPERATOR";
    const { admin, operator } = await requireConsoleAccess(minRole);

    const expiresAt = new Date(Date.now() + DEFAULT_SESSION_MS);

    const { data: session, error: sessionError } = await admin
      .from("app_console_impersonation_sessions")
      .insert({
        operator_id: operator.id,
        target_tenant_id: input.tenantId,
        target_user_id: input.targetUserId ?? null,
        mode,
        reason: trimmedReason,
        expires_at: expiresAt.toISOString(),
      })
      .select("id")
      .single();

    if (sessionError) return { error: sessionError.message };

    const encoded = encodeImpersonationCookie({
      sessionId: session.id,
      tenantId: input.tenantId,
      userId: input.targetUserId ?? null,
      mode,
      exp: expiresAt.getTime(),
    });

    if (!encoded) {
      return { error: "Impersonation secret is not configured (CONSOLE_IMPERSONATION_SECRET)" };
    }

    const cookieStore = await cookies();
    cookieStore.set(IMPERSONATION_COOKIE_NAME, encoded, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: DEFAULT_SESSION_MS / 1000,
    });

    const jwtError = await applyImpersonationJwt(session.id);
    if (jwtError) {
      cookieStore.delete(IMPERSONATION_COOKIE_NAME);
      await admin
        .from("app_console_impersonation_sessions")
        .update({ ended_at: new Date().toISOString(), ended_by: operator.user_id })
        .eq("id", session.id);
      return { error: jwtError };
    }

    await logConsoleAction({
      admin,
      operator,
      action: "IMPERSONATION_START",
      targetType: "tenant",
      targetId: input.tenantId,
      tenantId: input.tenantId,
      payload: {
        session_id: session.id,
        target_user_id: input.targetUserId ?? null,
        mode,
        reason: trimmedReason,
      },
    });

    revalidateImpersonationPaths(input.tenantId);
    revalidatePath("/dashboard");
    return { ok: true as const, redirectTo: "/dashboard" as const };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return actionError(error);
  }
}

export async function endImpersonation(sessionId?: string) {
  try {
    const { admin, operator, claims } = await requireConsoleAccess("OPERATOR");

    const cookieStore = await cookies();
    const rawCookie = cookieStore.get(IMPERSONATION_COOKIE_NAME)?.value;
    const payload = decodeImpersonationCookie(rawCookie);
    const resolvedSessionId = sessionId ?? payload?.sessionId;

    if (!resolvedSessionId) {
      const jwtSessionId = claims.appMetadata.console_impersonation_session_id;
      if (typeof jwtSessionId === "string") {
        await restoreImpersonationJwt(jwtSessionId);
      }
      cookieStore.delete(IMPERSONATION_COOKIE_NAME);
      redirect("/console");
    }

    const { data: session, error: lookupError } = await admin
      .from("app_console_impersonation_sessions")
      .select("id, target_tenant_id, ended_at")
      .eq("id", resolvedSessionId)
      .maybeSingle();

    if (lookupError) return { error: lookupError.message };

    if (session && !session.ended_at) {
      const { error: updateError } = await admin
        .from("app_console_impersonation_sessions")
        .update({
          ended_at: new Date().toISOString(),
          ended_by: claims.userId,
        })
        .eq("id", resolvedSessionId);

      if (updateError) return { error: updateError.message };
    }

    const jwtError = await restoreImpersonationJwt(resolvedSessionId);
    if (jwtError) return { error: jwtError };

    cookieStore.delete(IMPERSONATION_COOKIE_NAME);

    await logConsoleAction({
      admin,
      operator,
      action: "IMPERSONATION_END",
      targetType: "impersonation_session",
      targetId: resolvedSessionId,
      tenantId: session?.target_tenant_id ?? payload?.tenantId,
      payload: { session_id: resolvedSessionId },
    });

    revalidateImpersonationPaths(session?.target_tenant_id ?? payload?.tenantId);
    revalidatePath("/console/tenants");
    revalidatePath("/dashboard");
    redirect("/console");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return actionError(error);
  }
}

