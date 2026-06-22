"use server";

import { revalidatePath } from "next/cache";
import { requireConsoleAccess, ConsoleAccessError } from "../require-console";
import { logConsoleAction } from "../audit";
import { formatRpcDeployError, isMissingRpcError } from "@/lib/supabase/rpc-error";

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

export async function purgeDueWorkspaceDeletions() {
  try {
    const { admin, operator } = await requireConsoleAccess("OPERATOR");

    const { data, error } = await admin.rpc("purge_due_tenant_workspace_deletions");

    if (error) {
      if (isMissingRpcError(error)) {
        return { error: formatRpcDeployError("purge_due_tenant_workspace_deletions") };
      }
      return { error: error.message };
    }

    const payload = (data ?? {}) as Record<string, unknown>;
    const purgedCount = typeof payload.purged_count === "number" ? payload.purged_count : 0;
    const failedCount = typeof payload.failed_count === "number" ? payload.failed_count : 0;

    await logConsoleAction({
      admin,
      operator,
      action: "TENANT_STATUS_UPDATE",
      targetType: "workspace_deletion_purge",
      payload: { purged_count: purgedCount, failed_count: failedCount },
    });

    revalidatePath("/console/settings/platform");
    return { ok: true as const, purgedCount, failedCount };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    return actionError(error);
  }
}
